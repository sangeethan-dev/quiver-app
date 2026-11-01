import {
  copyFile,
  decodeText,
  fileExists,
  freeFileName,
  isNotFoundError,
  listFiles,
  openSubfolder,
  removeFileIfPresent,
  writeFile,
} from "@/lib/fs/files";
import { generateId } from "@/lib/id";
import {
  parsePromptFile,
  sameBody,
  serializePromptFile,
  withLineEndingsOf,
  type Prompt,
} from "@/lib/prompt-file";
import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  type Settings,
} from "@/lib/settings";
import { promptFileName } from "@/lib/slug";
import { localTimestamp } from "@/lib/time";

const SETTINGS_FILE = "_settings.json";
const BROKEN_SETTINGS_FILE = "_settings.broken.json";
const HISTORY_FOLDER = "_history";
const TRASH_FOLDER = "_trash";
const HISTORY_FILE = /^v(\d+)\.md$/;
const UNTITLED = "Untitled";

/** The fields the editor changes. */
export type PromptDraft = Pick<Prompt, "title" | "model" | "tags" | "body">;

export interface VaultEntry {
  prompt: Prompt;
  fileName: string;
  /** When the file last changed, as of loading it. A save compares this against the disk. */
  lastModified: number;
}

export interface UnreadableFile {
  fileName: string;
  reason: string;
}

export interface VaultSnapshot {
  entries: VaultEntry[];
  unreadable: UnreadableFile[];
  settings: Settings;
  /** Set when `_settings.json` can't be used and the defaults are standing in. */
  settingsProblem?: string;
}

export type SaveResult =
  | { status: "saved"; snapshot: VaultSnapshot; entry: VaultEntry }
  /** `disk` is null when the file is gone or can no longer be read. */
  | { status: "conflict"; disk: VaultEntry | null };

export interface TrashedFile {
  fileName: string;
  title: string;
  trashedAt: number;
}

export interface HistoryVersion {
  version: number;
  savedAt: string;
  title: string;
  body: string;
}

interface ScannedFile {
  fileName: string;
  size: number;
  lastModified: number;
  entry?: VaultEntry;
  problem?: string;
  /** False for failures that may pass, such as a file that's briefly locked. */
  cacheable: boolean;
}

interface SettingsFile {
  size: number;
  lastModified: number;
  settings: Settings;
  extra: Record<string, unknown>;
  problem?: string;
}

interface DiskPrompt {
  lastModified: number;
  /** Null when the file exists but can't be parsed. */
  prompt: Prompt | null;
}

function isPromptFile(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith(".") && /\.md$/i.test(name);
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

function sameContent(a: PromptDraft, b: PromptDraft): boolean {
  return (
    a.title === b.title &&
    a.model === b.model &&
    sameTags(a.tags, b.tags) &&
    sameBody(a.body, b.body)
  );
}

function hasCanonicalName(file: ScannedFile): boolean {
  return !!file.entry && file.fileName.endsWith(`--${file.entry.prompt.id}.md`);
}

function parseText(text: string) {
  const result = parsePromptFile(text);
  return result.ok ? result.prompt : null;
}

async function readText(file: File): Promise<string | null> {
  try {
    return decodeText(await file.arrayBuffer());
  } catch (error) {
    if (error instanceof TypeError) return null; // Not UTF-8.
    throw error;
  }
}

function findEntry(snapshot: VaultSnapshot, id: string): VaultEntry {
  const entry = snapshot.entries.find(({ prompt }) => prompt.id === id);
  if (!entry) throw new Error("This prompt no longer exists.");
  return entry;
}

/**
 * All access to the folder goes through this class, one operation at a time, so
 * a rescan can't overlap a save and report a half-finished state.
 */
export class Vault {
  private files = new Map<string, ScannedFile>();
  private settingsFile: SettingsFile | null = null;
  private snapshot: VaultSnapshot = { entries: [], unreadable: [], settings: DEFAULT_SETTINGS };
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly root: FileSystemDirectoryHandle) {}

  get folderName(): string {
    return this.root.name;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Reads only what changed, and returns the same snapshot if nothing did. */
  refresh(): Promise<VaultSnapshot> {
    return this.enqueue(() => this.scan());
  }

  private async scan(): Promise<VaultSnapshot> {
    const handles = (await listFiles(this.root)).filter((handle) => isPromptFile(handle.name));
    const scanned = await Promise.all(handles.map((handle) => this.scanFile(handle)));
    const found = scanned.filter((file) => file !== null);

    this.files = new Map(found.filter((file) => file.cacheable).map((f) => [f.fileName, f]));

    // A copy made in Explorer keeps the id. The file named after that id stays the prompt.
    const ordered = [...found].sort(
      (a, b) =>
        Number(hasCanonicalName(b)) - Number(hasCanonicalName(a)) ||
        (a.fileName < b.fileName ? -1 : 1),
    );

    const entries: VaultEntry[] = [];
    const unreadable: UnreadableFile[] = [];
    const owners = new Map<string, string>();

    for (const file of ordered) {
      if (!file.entry) {
        unreadable.push({ fileName: file.fileName, reason: file.problem ?? "Unknown problem" });
        continue;
      }
      const owner = owners.get(file.entry.prompt.id);
      if (owner) {
        unreadable.push({ fileName: file.fileName, reason: `Same id as ${owner}` });
      } else {
        owners.set(file.entry.prompt.id, file.fileName);
        entries.push(file.entry);
      }
    }

    entries.sort((a, b) => (a.fileName < b.fileName ? -1 : 1));
    unreadable.sort((a, b) => (a.fileName < b.fileName ? -1 : 1));

    const { settings, problem: settingsProblem } = await this.scanSettings();
    const next: VaultSnapshot = { entries, unreadable, settings, settingsProblem };
    if (!this.isUnchanged(next)) this.snapshot = next;
    return this.snapshot;
  }

  private isUnchanged(next: VaultSnapshot): boolean {
    const { entries, unreadable, settings, settingsProblem } = this.snapshot;
    return (
      next.settings === settings &&
      next.settingsProblem === settingsProblem &&
      next.entries.length === entries.length &&
      next.entries.every((entry, index) => entry === entries[index]) &&
      JSON.stringify(next.unreadable) === JSON.stringify(unreadable)
    );
  }

  private async scanFile(handle: FileSystemFileHandle): Promise<ScannedFile | null> {
    const fileName = handle.name;
    let file: File;

    try {
      file = await handle.getFile();
    } catch (error) {
      if (isNotFoundError(error)) return null;
      return { fileName, size: 0, lastModified: 0, problem: "Couldn't open it", cacheable: false };
    }

    const { size, lastModified } = file;
    const known = this.files.get(fileName);
    if (known && known.size === size && known.lastModified === lastModified) return known;

    const details = { fileName, size, lastModified };
    let text: string | null;

    try {
      text = await readText(file);
    } catch {
      return { ...details, problem: "Couldn't open it", cacheable: false };
    }
    if (text === null) return { ...details, problem: "Not UTF-8 text", cacheable: true };

    const result = parsePromptFile(text);
    return result.ok
      ? { ...details, entry: { prompt: result.prompt, fileName, lastModified }, cacheable: true }
      : { ...details, problem: result.error, cacheable: true };
  }

  private async scanSettings(): Promise<SettingsFile> {
    if (!(await fileExists(this.root, SETTINGS_FILE))) {
      await writeFile(this.root, SETTINGS_FILE, serializeSettings(DEFAULT_SETTINGS));
    }

    const handle = await this.root.getFileHandle(SETTINGS_FILE);
    const file = await handle.getFile();
    const { size, lastModified } = file;

    const known = this.settingsFile;
    if (known && known.size === size && known.lastModified === lastModified) return known;

    const text = await readText(file);
    const result = parseSettings(text ?? "");

    this.settingsFile = result.ok
      ? { size, lastModified, settings: result.settings, extra: result.extra }
      : {
          size,
          lastModified,
          settings: DEFAULT_SETTINGS,
          extra: {},
          problem: text === null ? "Not UTF-8 text" : result.error,
        };
    return this.settingsFile;
  }

  saveSettings(settings: Settings): Promise<VaultSnapshot> {
    return this.enqueue(async () => {
      const current = this.settingsFile;
      if (current?.problem) await copyFile(this.root, SETTINGS_FILE, this.root, BROKEN_SETTINGS_FILE);

      await writeFile(this.root, SETTINGS_FILE, serializeSettings(settings, current?.extra));
      return this.scan();
    });
  }

  create(draft: PromptDraft): Promise<{ snapshot: VaultSnapshot; entry: VaultEntry }> {
    return this.enqueue(async () => {
      const taken = new Set(this.snapshot.entries.map(({ prompt }) => prompt.id));
      const now = localTimestamp();
      const prompt: Prompt = {
        ...draft,
        id: generateId(taken),
        title: draft.title.trim() || UNTITLED,
        favorite: false,
        version: 1,
        created: now,
        updated: now,
        useCount: 0,
      };

      await writeFile(this.root, promptFileName(prompt.title, prompt.id), serializePromptFile(prompt));
      const snapshot = await this.scan();
      return { snapshot, entry: findEntry(snapshot, prompt.id) };
    });
  }

  /**
   * Applies an edit that started from `base`. Unless `force` is set, the result is
   * a conflict if the file's content changed since then. A change to the timestamp
   * or to usage counts alone isn't one, because the editor doesn't touch those.
   *
   * `force` is "Keep mine". If the file on disk would lose text, it goes to history.
   */
  save(
    base: VaultEntry,
    draft: PromptDraft,
    { force = false }: { force?: boolean } = {},
  ): Promise<SaveResult> {
    return this.enqueue(async () => {
      const { id } = base.prompt;

      // After a rename in Explorer and a rescan, the file has a new name but the same id.
      const known = this.snapshot.entries.find(({ prompt }) => prompt.id === id);
      const fileName = known?.fileName ?? base.fileName;
      const disk = await this.readPrompt(fileName);

      if (!force) {
        if (!disk?.prompt) return { status: "conflict", disk: null };
        const moved = disk.lastModified !== base.lastModified;
        if (moved && !sameContent(disk.prompt, base.prompt)) {
          return {
            status: "conflict",
            disk: { prompt: disk.prompt, fileName, lastModified: disk.lastModified },
          };
        }
      }

      // Start from the disk so usage counts and hand-added fields survive the edit.
      const current = disk?.prompt ?? base.prompt;
      const title = draft.title.trim() || UNTITLED;
      const edited = { ...draft, title };

      if (disk?.prompt && sameContent(current, edited)) {
        const snapshot = await this.scan();
        return { status: "saved", snapshot, entry: findEntry(snapshot, id) };
      }

      const bodyChanged = !sameBody(current.body, draft.body);
      const overwritesUnreadableFile = disk !== null && !disk.prompt;

      let version = current.version;
      if (disk && (bodyChanged || overwritesUnreadableFile)) {
        version = (await this.archive(fileName, id, current.version)) + 1;
      }

      const body = bodyChanged ? withLineEndingsOf(current.body, draft.body) : current.body;
      const updated = localTimestamp();
      const next: Prompt = { ...current, ...edited, body, version, updated };
      const nextName = promptFileName(title, id);

      // In this order, a failure part way can leave a spare copy but can't lose the prompt.
      await writeFile(this.root, nextName, serializePromptFile(next));
      if (nextName !== fileName) await removeFileIfPresent(this.root, fileName);

      const snapshot = await this.scan();
      return { status: "saved", snapshot, entry: findEntry(snapshot, id) };
    });
  }

  /** Copies the file into history and returns the version number it was stored under. */
  private async archive(fileName: string, id: string, version: number): Promise<number> {
    const history = await this.root.getDirectoryHandle(HISTORY_FOLDER, { create: true });
    const folder = await history.getDirectoryHandle(id, { create: true });
    const stored = (await listFiles(folder)).flatMap(({ name }) => {
      const match = HISTORY_FILE.exec(name);
      return match ? [Number(match[1])] : [];
    });

    // `version` can be behind if the file was edited by hand. Never overwrite a version.
    const archived = Math.max(version, ...stored.map((number) => number + 1));
    await copyFile(this.root, fileName, folder, `v${archived}.md`);
    return archived;
  }

  private async readPrompt(fileName: string): Promise<DiskPrompt | null> {
    let file: File;
    try {
      const handle = await this.root.getFileHandle(fileName);
      file = await handle.getFile();
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }

    const text = await readText(file);
    return { lastModified: file.lastModified, prompt: text === null ? null : parseText(text) };
  }

  /** Changes the favorite flag on the current file, keeping any outside edit. */
  setFavorite(id: string, favorite: boolean): Promise<VaultSnapshot> {
    return this.enqueue(async () => {
      const { fileName } = findEntry(this.snapshot, id);
      const disk = await this.readPrompt(fileName);
      if (!disk?.prompt) throw new Error("This prompt's file can no longer be read.");

      await writeFile(this.root, fileName, serializePromptFile({ ...disk.prompt, favorite }));
      return this.scan();
    });
  }

  /** Returns the name in `_trash`, which is what an undo needs. */
  moveToTrash(id: string): Promise<{ snapshot: VaultSnapshot; trashName: string }> {
    return this.enqueue(async () => {
      const { fileName } = findEntry(this.snapshot, id);
      const trash = await this.root.getDirectoryHandle(TRASH_FOLDER, { create: true });
      const trashName = await freeFileName(trash, fileName);

      await copyFile(this.root, fileName, trash, trashName);
      await this.root.removeEntry(fileName);
      return { snapshot: await this.scan(), trashName };
    });
  }

  restoreFromTrash(trashName: string): Promise<VaultSnapshot> {
    return this.enqueue(async () => {
      const trash = await this.root.getDirectoryHandle(TRASH_FOLDER);
      const handle = await trash.getFileHandle(trashName);
      const text = await readText(await handle.getFile());
      const prompt = text === null ? null : parseText(text);

      if (prompt && this.snapshot.entries.some((entry) => entry.prompt.id === prompt.id)) {
        throw new Error("A prompt with the same id is already in the vault.");
      }

      const name = prompt ? promptFileName(prompt.title, prompt.id) : trashName;
      await copyFile(trash, trashName, this.root, await freeFileName(this.root, name));
      await trash.removeEntry(trashName);
      return this.scan();
    });
  }

  listTrash(): Promise<TrashedFile[]> {
    return this.enqueue(async () => {
      const trash = await openSubfolder(this.root, TRASH_FOLDER);
      if (!trash) return [];

      const trashed = await Promise.all(
        (await listFiles(trash)).map(async (handle) => {
          const file = await handle.getFile();
          const text = await readText(file);
          const prompt = text === null ? null : parseText(text);
          return {
            fileName: handle.name,
            title: prompt?.title ?? handle.name,
            trashedAt: file.lastModified,
          };
        }),
      );
      return trashed.sort((a, b) => b.trashedAt - a.trashedAt);
    });
  }

  /** The only place Quiver permanently deletes anything. History is left in place. */
  emptyTrash(): Promise<void> {
    return this.enqueue(async () => {
      const trash = await openSubfolder(this.root, TRASH_FOLDER);
      if (!trash) return;
      for await (const handle of trash.values()) {
        await trash.removeEntry(handle.name, { recursive: true });
      }
    });
  }

  /** Newest first. */
  listHistory(id: string): Promise<HistoryVersion[]> {
    return this.enqueue(async () => {
      const history = await openSubfolder(this.root, HISTORY_FOLDER);
      const folder = history && (await openSubfolder(history, id));
      if (!folder) return [];

      const handles = (await listFiles(folder)).filter(({ name }) => HISTORY_FILE.test(name));
      const versions = await Promise.all(
        handles.map(async (handle) => {
          const file = await handle.getFile();
          const text = (await readText(file)) ?? "";
          const prompt = parseText(text);
          return {
            version: Number(HISTORY_FILE.exec(handle.name)?.[1]),
            savedAt: prompt?.updated || new Date(file.lastModified).toISOString(),
            title: prompt?.title ?? handle.name,
            body: prompt?.body ?? text,
          };
        }),
      );
      return versions.sort((a, b) => b.version - a.version);
    });
  }
}
