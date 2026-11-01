import { beforeEach, describe, expect, it } from "vitest";
import { Vault, type PromptDraft, type SaveResult, type VaultEntry } from "@/lib/fs/vault";
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from "@/lib/settings";
import { FakeDirectory } from "./helpers/fake-directory";

const FILE = "rewrite--abc123.md";

function promptText({
  id = "abc123",
  title = "Rewrite",
  version = 1,
  body = "Body\n",
  extra = "",
} = {}): string {
  return `---\nid: ${id}\ntitle: ${title}\nmodel: claude\ntags: [one]\nfavorite: false\nversion: ${version}\ncreated: 2026-01-01T00:00:00+00:00\nupdated: 2026-01-01T00:00:00+00:00\nuseCount: 4\n${extra}---\n${body}`;
}

function draftOf(entry: VaultEntry, changes: Partial<PromptDraft> = {}): PromptDraft {
  const { title, model, tags, body } = entry.prompt;
  return { title, model, tags, body, ...changes };
}

function saved(result: SaveResult) {
  if (result.status !== "saved") throw new Error("expected the save to succeed");
  return result;
}

const domError = (name: string) => new DOMException("simulated", name);

let root: FakeDirectory;
let vault: Vault;

async function loaded(text = promptText(), name = FILE): Promise<VaultEntry> {
  root.put(name, text);
  const snapshot = await vault.refresh();
  return snapshot.entries.find((entry) => entry.fileName === name)!;
}

beforeEach(() => {
  root = new FakeDirectory();
  vault = new Vault(root.handle);
});

describe("refresh", () => {
  it("lists the prompts in the folder", async () => {
    root.put(FILE, promptText());
    const { entries, unreadable } = await vault.refresh();

    expect(entries).toHaveLength(1);
    expect(entries[0].fileName).toBe(FILE);
    expect(entries[0].prompt.title).toBe("Rewrite");
    expect(unreadable).toEqual([]);
  });

  it("handles an empty folder", async () => {
    const { entries, unreadable } = await vault.refresh();
    expect(entries).toEqual([]);
    expect(unreadable).toEqual([]);
  });

  it("ignores names starting with _ or . and anything that isn't Markdown", async () => {
    root.put("_notes.md", "not a prompt");
    root.put(".hidden.md", "not a prompt");
    root.put("notes.txt", "not a prompt");
    root.put("image.png", new Uint8Array([1, 2, 3]));
    root.put("x.md.crswap", "unfinished write");
    await root.getDirectoryHandle("folder.md", { create: true });

    const { entries, unreadable } = await vault.refresh();
    expect(entries).toEqual([]);
    expect(unreadable).toEqual([]);
  });

  it("accepts an uppercase .MD extension", async () => {
    root.put("rewrite--abc123.MD", promptText());
    expect((await vault.refresh()).entries).toHaveLength(1);
  });

  it("reports a broken file with its name and keeps reading the rest", async () => {
    root.put(FILE, promptText());
    root.put("broken.md", "No front matter here");
    root.put("bad-yaml.md", "---\nid: [\n---\n");

    const { entries, unreadable } = await vault.refresh();
    expect(entries).toHaveLength(1);
    expect(unreadable.map((file) => file.fileName)).toEqual(["bad-yaml.md", "broken.md"]);
    expect(unreadable[1].reason).toBe("No front matter found");
  });

  it("reports a file that isn't UTF-8 instead of garbling it", async () => {
    root.put("latin.md", new Uint8Array([0x63, 0x61, 0x66, 0xe9]));
    expect((await vault.refresh()).unreadable).toEqual([
      { fileName: "latin.md", reason: "Not UTF-8 text" },
    ]);
  });

  it("picks up a new file, an edit and a removal from outside", async () => {
    await loaded();

    root.put("other--def456.md", promptText({ id: "def456", title: "Other" }));
    expect((await vault.refresh()).entries).toHaveLength(2);

    root.put(FILE, promptText({ title: "Edited in Notepad" }));
    const edited = await vault.refresh();
    expect(edited.entries.find((e) => e.fileName === FILE)?.prompt.title).toBe("Edited in Notepad");

    await root.removeEntry("other--def456.md");
    expect((await vault.refresh()).entries).toHaveLength(1);
  });

  it("picks up a file once it has been fixed", async () => {
    root.put("broken.md", "oops");
    expect((await vault.refresh()).unreadable).toHaveLength(1);

    root.put("broken.md", promptText());
    const { entries, unreadable } = await vault.refresh();
    expect(entries).toHaveLength(1);
    expect(unreadable).toEqual([]);
  });

  it("returns the same snapshot when nothing changed, so search isn't rebuilt", async () => {
    root.put(FILE, promptText());
    const first = await vault.refresh();
    expect(await vault.refresh()).toBe(first);
  });

  it("keeps unchanged entries identical when another file changes", async () => {
    const entry = await loaded();
    root.put("other--def456.md", promptText({ id: "def456" }));
    const { entries } = await vault.refresh();
    expect(entries.find((e) => e.fileName === FILE)).toBe(entry);
  });

  it("retries a file that was briefly locked", async () => {
    root.put(FILE, promptText());
    root.failNext = { action: "read", error: domError("NotReadableError") };
    expect((await vault.refresh()).unreadable[0].fileName).toBe(FILE);

    const { entries, unreadable } = await vault.refresh();
    expect(entries).toHaveLength(1);
    expect(unreadable).toEqual([]);
  });

  it("retries a file that opened but couldn't be read", async () => {
    root.put(FILE, promptText());
    root.failNext = { action: "content", error: domError("NotReadableError") };
    expect((await vault.refresh()).unreadable).toEqual([
      { fileName: FILE, reason: "Couldn't open it" },
    ]);

    const { entries, unreadable } = await vault.refresh();
    expect(entries).toHaveLength(1);
    expect(unreadable).toEqual([]);
  });

  it("rejects when the folder is gone", async () => {
    root.removed = true;
    await expect(vault.refresh()).rejects.toMatchObject({ name: "NotFoundError" });
  });

  describe("copies with the same id", () => {
    const copy = "rewrite--abc123 - Copy.md";

    it("keeps the file named after the id and reports the copy", async () => {
      root.put(FILE, promptText());
      root.put(copy, promptText({ title: "Copy" }));

      const { entries, unreadable } = await vault.refresh();
      expect(entries.map((entry) => entry.fileName)).toEqual([FILE]);
      expect(unreadable).toEqual([{ fileName: copy, reason: `Same id as ${FILE}` }]);
    });

    it("picks one when neither has the usual name", async () => {
      root.put("a.md", promptText());
      root.put("b.md", promptText());

      const { entries, unreadable } = await vault.refresh();
      expect(entries.map((entry) => entry.fileName)).toEqual(["a.md"]);
      expect(unreadable).toEqual([{ fileName: "b.md", reason: "Same id as a.md" }]);
    });
  });
});

describe("settings", () => {
  it("creates the file with defaults if it's missing", async () => {
    const { settings } = await vault.refresh();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(root.read("_settings.json"))).toMatchObject({
      ok: true,
      settings: DEFAULT_SETTINGS,
    });
  });

  it("uses an existing file without rewriting it", async () => {
    const text = '{ "models": [ { "id": "local", "name": "Local", "color": "#112233" } ] }';
    root.put("_settings.json", text);

    const { settings } = await vault.refresh();
    expect(settings.models.map((model) => model.id)).toEqual(["local"]);
    expect(root.read("_settings.json")).toBe(text);
  });

  it("falls back to defaults for a broken file and leaves it alone", async () => {
    root.put("_settings.json", "{ oops");
    const { settings, settingsProblem } = await vault.refresh();

    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settingsProblem).toBe("The file isn't valid JSON");
    expect(root.read("_settings.json")).toBe("{ oops");
  });

  it("notices when settings are edited outside the app", async () => {
    await vault.refresh();
    root.put("_settings.json", '{"models":[{"id":"x","name":"X","color":"#000000"}]}');
    expect((await vault.refresh()).settings.models[0].id).toBe("x");
  });

  it("saves changes and keeps fields it doesn't know about", async () => {
    root.put("_settings.json", '{"note":"mine","models":[]}');
    await vault.refresh();

    const models = [{ id: "a", name: "A", color: "#123456" }];
    const { settings } = await vault.saveSettings({ models });

    expect(settings.models).toEqual(models);
    expect(JSON.parse(root.read("_settings.json"))).toEqual({ note: "mine", models });
  });

  it("backs up a broken file before replacing it", async () => {
    root.put("_settings.json", "{ oops");
    await vault.refresh();

    const { settingsProblem } = await vault.saveSettings(DEFAULT_SETTINGS);
    expect(settingsProblem).toBeUndefined();
    expect(root.read("_settings.broken.json")).toBe("{ oops");
    expect(root.read("_settings.json")).toBe(serializeSettings(DEFAULT_SETTINGS));
  });
});

describe("create", () => {
  const draft = { title: "Summarize · exec brief", model: "gemini", tags: ["work"], body: "Hi\n" };

  it("writes a file named after the title and id", async () => {
    const { entry } = await vault.create(draft);

    expect(entry.fileName).toBe(`summarize-exec-brief--${entry.prompt.id}.md`);
    expect(root.has(entry.fileName)).toBe(true);
    expect(root.read(entry.fileName)).toContain("title: Summarize · exec brief\nmodel: gemini\n");
  });

  it("sets up a new prompt", async () => {
    const { prompt } = (await vault.create(draft)).entry;

    expect(prompt).toMatchObject({ ...draft, version: 1, useCount: 0, favorite: false });
    expect(prompt.created).toBe(prompt.updated);
    expect(prompt.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(prompt.lastUsed).toBeUndefined();
  });

  it("adds it to the snapshot", async () => {
    const { snapshot, entry } = await vault.create(draft);
    expect(snapshot.entries).toContain(entry);
  });

  it("names a prompt with no title", async () => {
    const { entry } = await vault.create({ ...draft, title: "   " });
    expect(entry.prompt.title).toBe("Untitled");
    expect(entry.fileName).toBe(`untitled--${entry.prompt.id}.md`);
  });

  it("surfaces a failed write without leaving a partial file", async () => {
    await vault.refresh();
    root.failNext = { action: "write", error: domError("QuotaExceededError") };

    await expect(vault.create(draft)).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect((await vault.refresh()).entries).toEqual([]);
  });
});

describe("save", () => {
  it("writes the edit to the file", async () => {
    const entry = await loaded();
    const result = saved(await vault.save(entry, draftOf(entry, { body: "New\n" })));

    expect(result.entry.prompt.body).toBe("New\n");
    expect(root.read(FILE)).toContain("---\nNew\n");
  });

  it("keeps created, usage counts and fields it doesn't know about", async () => {
    const entry = await loaded(promptText({ extra: "author: me # kept\n" }));
    const { prompt } = saved(await vault.save(entry, draftOf(entry, { body: "New\n" }))).entry;

    expect(prompt.useCount).toBe(4);
    expect(prompt.created).toBe("2026-01-01T00:00:00+00:00");
    expect(root.read(FILE)).toContain("author: me # kept\n");
  });

  it("updates the timestamp", async () => {
    const entry = await loaded();
    const { prompt } = saved(await vault.save(entry, draftOf(entry, { tags: ["two"] }))).entry;
    expect(prompt.updated).not.toBe(entry.prompt.updated);
  });

  it("doesn't touch the file when nothing changed", async () => {
    const entry = await loaded();
    const result = saved(await vault.save(entry, draftOf(entry)));

    expect(result.entry).toBe(entry);
    expect(root.read(FILE)).toBe(promptText());
  });

  it("can save again straight after saving", async () => {
    const entry = await loaded();
    const first = saved(await vault.save(entry, draftOf(entry, { body: "One\n" }))).entry;
    const second = saved(await vault.save(first, draftOf(first, { body: "Two\n" }))).entry;

    expect(second.prompt.version).toBe(3);
    expect(root.paths()).toContain("_history/abc123/v2.md");
  });

  describe("versions", () => {
    it("archives the previous file when the body changes", async () => {
      const original = promptText({ version: 3 });
      const entry = await loaded(original);
      const { prompt } = saved(await vault.save(entry, draftOf(entry, { body: "New\n" }))).entry;

      expect(prompt.version).toBe(4);
      expect(root.folder("_history").folder("abc123").read("v3.md")).toBe(original);
    });

    it.each([
      ["title", { title: "New title" }],
      ["model", { model: "gemini" }],
      ["tags", { tags: ["a", "b"] }],
    ])("doesn't create a version for a %s change", async (_label, changes) => {
      const entry = await loaded();
      const { prompt } = saved(await vault.save(entry, draftOf(entry, changes))).entry;

      expect(prompt.version).toBe(1);
      expect(root.has("_history")).toBe(false);
    });

    it("never overwrites a stored version", async () => {
      const entry = await loaded(promptText({ version: 2, body: "Current\n" }));
      const stored = await root.getDirectoryHandle("_history", { create: true });
      (await stored.getDirectoryHandle("abc123", { create: true })).put("v2.md", "older");
      (await stored.getDirectoryHandle("abc123")).put("v7.md", "newest");

      const { prompt } = saved(await vault.save(entry, draftOf(entry, { body: "New\n" }))).entry;

      const folder = root.folder("_history").folder("abc123");
      expect(folder.read("v2.md")).toBe("older");
      expect(folder.read("v7.md")).toBe("newest");
      expect(folder.read("v8.md")).toContain("Current");
      expect(prompt.version).toBe(9);
    });

    it("leaves the prompt alone if the archive can't be written", async () => {
      const original = promptText();
      const entry = await loaded(original);
      root.failNext = { action: "list", error: domError("NoModificationAllowedError") };

      await expect(vault.save(entry, draftOf(entry, { body: "New\n" }))).rejects.toBeDefined();
      expect(root.read(FILE)).toBe(original);
    });
  });

  describe("Windows line endings", () => {
    const crlf = promptText({ body: "one\r\ntwo\r\n" });

    it("doesn't see a textarea's LF as a change to a CRLF file", async () => {
      const entry = await loaded(crlf);
      const fromTextarea = draftOf(entry, { body: "one\ntwo\n" });
      saved(await vault.save(entry, fromTextarea));

      expect(root.has("_history")).toBe(false);
      expect(root.read(FILE)).toBe(crlf);
    });

    it("treats a tag change to a CRLF file as a tag change, not a new version", async () => {
      const entry = await loaded(crlf);
      const fromTextarea = draftOf(entry, { body: "one\ntwo\n", tags: ["two"] });
      const { prompt } = saved(await vault.save(entry, fromTextarea)).entry;

      expect(root.read(FILE)).toContain("---\none\r\ntwo\r\n");
      expect(prompt.version).toBe(1);
      expect(root.has("_history")).toBe(false);
    });

    it("keeps CRLF in an edited body", async () => {
      const entry = await loaded(crlf);
      await vault.save(entry, draftOf(entry, { body: "one\nthree\n" }));
      expect(root.read(FILE)).toContain("---\none\r\nthree\r\n");
    });

    it("keeps a byte order mark", async () => {
      const entry = await loaded(`﻿${promptText()}`);
      await vault.save(entry, draftOf(entry, { body: "New\n" }));
      expect(root.read(FILE).startsWith("﻿---\n")).toBe(true);
    });
  });

  describe("renaming", () => {
    const renamed = "new-title--abc123.md";

    it("moves the file when the title changes", async () => {
      const entry = await loaded();
      const result = saved(await vault.save(entry, draftOf(entry, { title: "New title" })));

      expect(result.entry.fileName).toBe(renamed);
      expect(root.has(renamed)).toBe(true);
      expect(root.has(FILE)).toBe(false);
      expect(result.snapshot.entries).toHaveLength(1);
    });

    it("keeps the old file if writing the new one fails", async () => {
      const original = promptText();
      const entry = await loaded(original);
      root.failNext = { action: "write", error: domError("QuotaExceededError") };

      await expect(vault.save(entry, draftOf(entry, { title: "New title" }))).rejects.toBeDefined();
      expect(root.read(FILE)).toBe(original);
    });

    it("doesn't rename for a change that gives the same slug", async () => {
      const entry = await loaded();
      const result = saved(await vault.save(entry, draftOf(entry, { title: "REWRITE!" })));
      expect(result.entry.fileName).toBe(FILE);
    });

    it("gives a blank title a usable name", async () => {
      const entry = await loaded();
      const result = saved(await vault.save(entry, draftOf(entry, { title: "  " })));
      expect(result.entry.prompt.title).toBe("Untitled");
    });
  });

  describe("conflicts", () => {
    const outside = promptText({ body: "Edited in Notepad\n" });

    it("stops if the file changed outside the app", async () => {
      const entry = await loaded();
      root.put(FILE, outside);

      const result = await vault.save(entry, draftOf(entry, { body: "Mine\n" }));

      expect(result.status).toBe("conflict");
      expect(result.status === "conflict" && result.disk?.prompt.body).toBe("Edited in Notepad\n");
      expect(root.read(FILE)).toBe(outside);
    });

    it("still stops after a rescan has loaded the outside edit", async () => {
      const entry = await loaded();
      root.put(FILE, outside);
      await vault.refresh();

      const result = await vault.save(entry, draftOf(entry, { body: "Mine\n" }));
      expect(result.status).toBe("conflict");
    });

    it("isn't a conflict if the file was saved with the same content", async () => {
      const entry = await loaded();
      root.put(FILE, promptText());
      const result = await vault.save(entry, draftOf(entry, { body: "Mine\n" }));
      expect(result.status).toBe("saved");
    });

    it("isn't a conflict if only the favorite flag or usage changed", async () => {
      const entry = await loaded();
      await vault.setFavorite("abc123", true);

      const { prompt } = saved(await vault.save(entry, draftOf(entry, { body: "Mine\n" }))).entry;
      expect(prompt.favorite).toBe(true);
    });

    it("Keep mine overwrites the file and saves the outside edit to history", async () => {
      const entry = await loaded();
      root.put(FILE, outside);

      const result = saved(
        await vault.save(entry, draftOf(entry, { body: "Mine\n" }), { force: true }),
      );

      expect(result.entry.prompt.body).toBe("Mine\n");
      expect(root.folder("_history").folder("abc123").read("v1.md")).toBe(outside);
    });

    it("Keep mine creates no version when the outside edit left the body the same", async () => {
      const entry = await loaded();
      root.put(FILE, promptText({ title: "Outside title" }));

      await vault.save(entry, draftOf(entry, { title: "Mine" }), { force: true });
      expect(root.has("_history")).toBe(false);
    });

    it("stops if the file was deleted outside the app", async () => {
      const entry = await loaded();
      await root.removeEntry(FILE);
      await vault.refresh();

      expect(await vault.save(entry, draftOf(entry))).toEqual({ status: "conflict", disk: null });
    });

    it("Keep mine brings a deleted file back", async () => {
      const entry = await loaded();
      await root.removeEntry(FILE);

      saved(await vault.save(entry, draftOf(entry, { body: "Mine\n" }), { force: true }));
      expect(root.read(FILE)).toContain("---\nMine\n");
    });

    it("stops if the file was damaged outside the app", async () => {
      const entry = await loaded();
      root.put(FILE, "no longer a prompt");
      expect(await vault.save(entry, draftOf(entry))).toEqual({ status: "conflict", disk: null });
    });

    it("Keep mine saves a damaged file to history before replacing it", async () => {
      const entry = await loaded();
      root.put(FILE, "no longer a prompt");

      saved(await vault.save(entry, draftOf(entry), { force: true }));
      expect(root.folder("_history").folder("abc123").read("v1.md")).toBe("no longer a prompt");
      expect(root.read(FILE)).toContain("title: Rewrite");
    });

    it("follows a file renamed in Explorer", async () => {
      const entry = await loaded();
      const newName = "renamed-by-hand.md";
      root.put(newName, root.read(FILE));
      await root.removeEntry(FILE);
      await vault.refresh();

      const result = saved(await vault.save(entry, draftOf(entry, { tags: ["two"] })));
      expect(result.entry.fileName).toBe(FILE);
      expect(root.has(newName)).toBe(false);
    });
  });
});

describe("setFavorite", () => {
  it("changes only the favorite line", async () => {
    await loaded();
    const { entries } = await vault.setFavorite("abc123", true);

    expect(entries[0].prompt.favorite).toBe(true);
    expect(root.read(FILE)).toBe(
      promptText().replace("favorite: false", "favorite: true"),
    );
  });

  it("doesn't create a version", async () => {
    await loaded();
    await vault.setFavorite("abc123", true);
    expect(root.has("_history")).toBe(false);
  });

  it("keeps an outside edit that hasn't been rescanned yet", async () => {
    await loaded();
    root.put(FILE, promptText({ body: "Edited in Notepad\n" }));

    await vault.setFavorite("abc123", true);
    expect(root.read(FILE)).toContain("Edited in Notepad");
  });

  it("refuses rather than overwrite a damaged file", async () => {
    await loaded();
    root.put(FILE, "no longer a prompt");

    await expect(vault.setFavorite("abc123", true)).rejects.toThrow("can no longer be read");
    expect(root.read(FILE)).toBe("no longer a prompt");
  });
});

describe("trash", () => {
  it("moves the file, keeping its exact contents", async () => {
    const original = `﻿${promptText().replace(/\n/g, "\r\n")}`;
    await loaded(original);

    const { snapshot, trashName } = await vault.moveToTrash("abc123");

    expect(snapshot.entries).toEqual([]);
    expect(root.has(FILE)).toBe(false);
    expect(trashName).toBe(FILE);
    expect(root.folder("_trash").read(FILE)).toBe(original);
  });

  it("keeps both when the same name is already in the trash", async () => {
    await loaded();
    await root.getDirectoryHandle("_trash", { create: true });
    root.folder("_trash").put(FILE, "older");

    const { trashName } = await vault.moveToTrash("abc123");

    expect(trashName).toBe("rewrite--abc123 (2).md");
    expect(root.folder("_trash").read(FILE)).toBe("older");
  });

  it("keeps the prompt if it can't be copied to the trash", async () => {
    await loaded();
    root.failNext = { action: "list", error: domError("NoModificationAllowedError") };

    await expect(vault.moveToTrash("abc123")).rejects.toBeDefined();
    expect(root.has(FILE)).toBe(true);
  });

  it("undoes a delete", async () => {
    const original = promptText();
    await loaded(original);
    const { trashName } = await vault.moveToTrash("abc123");

    const { entries } = await vault.restoreFromTrash(trashName);

    expect(entries).toHaveLength(1);
    expect(root.read(FILE)).toBe(original);
    expect(root.folder("_trash").has(FILE)).toBe(false);
  });

  it("restores a numbered trash file under its proper name", async () => {
    await loaded();
    await root.getDirectoryHandle("_trash", { create: true });
    root.folder("_trash").put(FILE, "older");
    const { trashName } = await vault.moveToTrash("abc123");

    await vault.restoreFromTrash(trashName);
    expect(root.has(FILE)).toBe(true);
  });

  it("won't restore over a prompt that has the same id", async () => {
    await loaded();
    const { trashName } = await vault.moveToTrash("abc123");
    await loaded();

    await expect(vault.restoreFromTrash(trashName)).rejects.toThrow("same id");
    expect(root.folder("_trash").has(trashName)).toBe(true);
  });

  it("can restore a file that isn't a valid prompt", async () => {
    await vault.refresh();
    await root.getDirectoryHandle("_trash", { create: true });
    root.folder("_trash").put("odd.md", "not a prompt");

    const { unreadable } = await vault.restoreFromTrash("odd.md");
    expect(unreadable.map((file) => file.fileName)).toEqual(["odd.md"]);
  });

  it("doesn't count trashed files as prompts", async () => {
    await loaded();
    await vault.moveToTrash("abc123");
    expect((await vault.refresh()).entries).toEqual([]);
  });

  it("lists the trash, newest first", async () => {
    await loaded();
    await loaded(promptText({ id: "def456", title: "Second" }), "second--def456.md");
    await vault.moveToTrash("abc123");
    await vault.moveToTrash("def456");
    await root.getDirectoryHandle("_trash", { create: true });
    root.folder("_trash").put("odd.md", "not a prompt");

    const trashed = await vault.listTrash();
    expect(trashed.map((file) => file.title)).toEqual(["odd.md", "Second", "Rewrite"]);
  });

  it("lists nothing before anything was deleted", async () => {
    expect(await vault.listTrash()).toEqual([]);
  });

  it("empties the trash and leaves everything else", async () => {
    const entry = await loaded();
    saved(await vault.save(entry, draftOf(entry, { body: "New\n" })));
    await vault.moveToTrash("abc123");
    await loaded(promptText({ id: "def456" }), "keep--def456.md");

    await vault.emptyTrash();

    expect(await vault.listTrash()).toEqual([]);
    expect(root.has("keep--def456.md")).toBe(true);
    expect(root.paths()).toContain("_history/abc123/v1.md");
  });

  it("empties an absent trash without complaint", async () => {
    await expect(vault.emptyTrash()).resolves.toBeUndefined();
  });
});

describe("history", () => {
  it("lists versions newest first, with their dates and text", async () => {
    const first = await loaded(promptText({ body: "First\n" }));
    const second = saved(await vault.save(first, draftOf(first, { body: "Second\n" }))).entry;
    saved(await vault.save(second, draftOf(second, { body: "Third\n" })));

    const versions = await vault.listHistory("abc123");

    expect(versions.map(({ version, body }) => [version, body])).toEqual([
      [2, "Second\n"],
      [1, "First\n"],
    ]);
    expect(versions[1].savedAt).toBe("2026-01-01T00:00:00+00:00");
  });

  it("sorts by number, not as text", async () => {
    await vault.refresh();
    const folder = await root.getDirectoryHandle("_history", { create: true });
    const versions = await folder.getDirectoryHandle("abc123", { create: true });
    versions.put("v2.md", promptText());
    versions.put("v10.md", promptText());
    versions.put("notes.txt", "ignored");

    expect((await vault.listHistory("abc123")).map((v) => v.version)).toEqual([10, 2]);
  });

  it("shows a version whose file can't be parsed as plain text", async () => {
    const folder = await root.getDirectoryHandle("_history", { create: true });
    (await folder.getDirectoryHandle("abc123", { create: true })).put("v1.md", "just text");

    const [version] = await vault.listHistory("abc123");
    expect(version).toMatchObject({ version: 1, body: "just text", title: "v1.md" });
  });

  it("is empty for a prompt with no versions", async () => {
    expect(await vault.listHistory("abc123")).toEqual([]);
  });

  it("restoring a version is a new version, and the current text isn't lost", async () => {
    let entry = await loaded(promptText({ body: "First\n" }));
    entry = saved(await vault.save(entry, draftOf(entry, { body: "Second\n" }))).entry;

    const [old] = await vault.listHistory("abc123");
    const { prompt } = saved(await vault.save(entry, draftOf(entry, { body: old.body }))).entry;

    expect(prompt.body).toBe("First\n");
    expect(prompt.version).toBe(3);
    expect(root.folder("_history").folder("abc123").read("v2.md")).toContain("Second");
  });
});

describe("one operation at a time", () => {
  it("runs overlapping saves in order without losing either", async () => {
    const entry = await loaded();
    const [first, second] = await Promise.all([
      vault.setFavorite("abc123", true),
      vault.save(entry, draftOf(entry, { body: "New\n" })),
    ]);

    expect(first.entries[0].prompt.favorite).toBe(true);
    expect(saved(second).entry.prompt).toMatchObject({ favorite: true, body: "New\n" });
  });

  it("keeps working after an operation fails", async () => {
    await loaded();
    root.failNext = { action: "write", error: domError("QuotaExceededError") };

    await expect(vault.setFavorite("abc123", true)).rejects.toBeDefined();
    expect((await vault.setFavorite("abc123", true)).entries[0].prompt.favorite).toBe(true);
  });

  it("reports the folder's name", () => {
    expect(vault.folderName).toBe("Quiver");
  });
});
