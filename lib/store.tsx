"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { describeFileError, isNotFoundError, isPermissionError } from "@/lib/fs/files";
import {
  isFolderAccessSupported,
  loadStoredFolder,
  pickFolder,
  queryFolderPermission,
  requestFolderPermission,
  requestPersistentStorage,
} from "@/lib/fs/handle";
import {
  Vault,
  type HistoryVersion,
  type PromptDraft,
  type PromptUse,
  type SaveResult,
  type TrashedFile,
  type VaultEntry,
  type VaultSnapshot,
} from "@/lib/fs/vault";
import type { Settings } from "@/lib/settings";
import { localTimestamp } from "@/lib/time";

// Copying often in a row should write each file once, not once per copy.
const USAGE_WRITE_DELAY_MS = 2000;

export type VaultState =
  | { status: "loading" }
  | { status: "unsupported" }
  | { status: "welcome" }
  | { status: "reconnect"; folderName: string }
  | { status: "missing"; folderName: string }
  | { status: "ready"; folderName: string; snapshot: VaultSnapshot };

interface VaultActions {
  chooseFolder(): Promise<void>;
  reconnect(): Promise<void>;
  refresh(): Promise<void>;
  createPrompt(draft: PromptDraft): Promise<VaultEntry | null>;
  createPrompts(drafts: readonly PromptDraft[]): Promise<void>;
  savePrompt(base: VaultEntry, draft: PromptDraft, force?: boolean): Promise<SaveResult | null>;
  /** Copies text. Passing a prompt id also counts it as a use of that prompt. */
  copyText(text: string, promptId?: string): Promise<boolean>;
  reassignModel(from: string, to: string): Promise<void>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  deletePrompt(id: string): Promise<void>;
  restoreFromTrash(fileName: string): Promise<void>;
  listTrash(): Promise<TrashedFile[]>;
  emptyTrash(): Promise<void>;
  listHistory(id: string): Promise<HistoryVersion[]>;
  saveSettings(settings: Settings): Promise<void>;
}

export interface LastCopy {
  promptId: string;
  at: number;
}

type VaultContextValue = VaultActions & { state: VaultState; lastCopy: LastCopy | null };

const VaultContext = createContext<VaultContextValue | null>(null);

// Context rather than Zustand: state changes only on vault operations, so it needs
// neither selectors nor a dependency, and the Vault class holds the real logic.
export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VaultState>({ status: "loading" });
  const [lastCopy, setLastCopy] = useState<LastCopy | null>(null);
  const folderRef = useRef<FileSystemDirectoryHandle | null>(null);
  const vaultRef = useRef<Vault | null>(null);

  const showSnapshot = useCallback((snapshot: VaultSnapshot) => {
    setState((previous) =>
      previous.status === "ready" && previous.snapshot === snapshot
        ? previous
        : { status: "ready", folderName: vaultRef.current?.folderName ?? "", snapshot },
    );
  }, []);

  const connect = useCallback(
    async (folder: FileSystemDirectoryHandle) => {
      folderRef.current = folder;
      try {
        const vault = new Vault(folder);
        const snapshot = await vault.refresh();
        vaultRef.current = vault;
        showSnapshot(snapshot);
        requestPersistentStorage();
      } catch (error) {
        if (isPermissionError(error)) {
          setState({ status: "reconnect", folderName: folder.name });
        } else if (isNotFoundError(error)) {
          setState({ status: "missing", folderName: folder.name });
        } else {
          setState({ status: "welcome" });
          toast.error(`Couldn't open the folder. ${describeFileError(error)}`);
        }
      }
    },
    [showSnapshot],
  );

  // A failure can mean the folder itself went away, so check that before going on.
  const syncAfterFailure = useCallback(async () => {
    const vault = vaultRef.current;
    if (!vault) return;
    try {
      showSnapshot(await vault.refresh());
    } catch (error) {
      if (isPermissionError(error)) {
        setState({ status: "reconnect", folderName: vault.folderName });
      } else if (isNotFoundError(error)) {
        setState({ status: "missing", folderName: vault.folderName });
      }
    }
  }, [showSnapshot]);

  const attempt = useCallback(
    async <T,>(failure: string, task: (vault: Vault) => Promise<T>): Promise<T | null> => {
      const vault = vaultRef.current;
      if (!vault) return null;
      try {
        return await task(vault);
      } catch (error) {
        toast.error(`${failure} ${describeFileError(error)}`);
        await syncAfterFailure();
        return null;
      }
    },
    [syncAfterFailure],
  );

  const refresh = useCallback(async () => {
    const snapshot = await attempt("Couldn't refresh the folder.", (vault) => vault.refresh());
    if (snapshot) showSnapshot(snapshot);
  }, [attempt, showSnapshot]);

  const pendingUses = useRef(new Map<string, PromptUse>());
  const usageTimer = useRef<number | undefined>(undefined);

  const writeUsage = useCallback(async () => {
    window.clearTimeout(usageTimer.current);
    const uses = pendingUses.current;
    if (uses.size === 0) return;

    pendingUses.current = new Map();
    const snapshot = await attempt("Couldn't update the usage count.", (vault) =>
      vault.recordUse(uses),
    );
    if (snapshot) showSnapshot(snapshot);
  }, [attempt, showSnapshot]);

  const noteUse = useCallback(
    (id: string) => {
      const count = (pendingUses.current.get(id)?.count ?? 0) + 1;
      pendingUses.current.set(id, { count, lastUsed: localTimestamp() });

      window.clearTimeout(usageTimer.current);
      usageTimer.current = window.setTimeout(() => void writeUsage(), USAGE_WRITE_DELAY_MS);
    },
    [writeUsage],
  );

  useEffect(() => {
    let active = true;

    async function start() {
      if (!isFolderAccessSupported()) {
        if (active) setState({ status: "unsupported" });
        return;
      }

      const folder = await loadStoredFolder();
      if (!active) return;
      if (!folder) {
        setState({ status: "welcome" });
        return;
      }

      folderRef.current = folder;
      try {
        if ((await queryFolderPermission(folder)) === "granted") {
          if (active) await connect(folder);
        } else if (active) {
          setState({ status: "reconnect", folderName: folder.name });
        }
      } catch {
        // A stored handle can stop working; choosing the folder again replaces it.
        if (active) setState({ status: "welcome" });
      }
    }

    void start();
    return () => {
      active = false;
    };
  }, [connect]);

  const ready = state.status === "ready";

  useEffect(() => {
    if (!ready) return;

    const rescan = () => {
      if (document.visibilityState === "visible") void syncAfterFailure();
      else void writeUsage(); // Leaving the page: don't wait for the timer.
    };

    window.addEventListener("focus", rescan);
    document.addEventListener("visibilitychange", rescan);
    return () => {
      window.removeEventListener("focus", rescan);
      document.removeEventListener("visibilitychange", rescan);
    };
  }, [ready, syncAfterFailure, writeUsage]);

  const actions = useMemo<VaultActions>(() => {
    async function restoreFromTrash(fileName: string) {
      const snapshot = await attempt("Couldn't restore the prompt.", (vault) =>
        vault.restoreFromTrash(fileName),
      );
      if (snapshot) showSnapshot(snapshot);
    }

    return {
      async chooseFolder() {
        try {
          const folder = await pickFolder();
          if (folder) {
            await writeUsage();
            await connect(folder);
          }
        } catch (error) {
          toast.error(`Couldn't open the folder. ${describeFileError(error)}`);
        }
      },

      async reconnect() {
        const folder = folderRef.current;
        if (!folder) return;
        try {
          if ((await requestFolderPermission(folder)) === "granted") {
            await connect(folder);
          } else {
            toast.error("Quiver needs permission to use the folder.");
          }
        } catch (error) {
          toast.error(`Couldn't reconnect the folder. ${describeFileError(error)}`);
        }
      },

      refresh,

      async createPrompt(draft) {
        const result = await attempt("Couldn't create the prompt.", (vault) => vault.create(draft));
        if (!result) return null;
        showSnapshot(result.snapshot);
        return result.entry;
      },

      async createPrompts(drafts) {
        for (const draft of drafts) {
          const result = await attempt("Couldn't create the prompt.", (vault) => vault.create(draft));
          if (!result) return;
          showSnapshot(result.snapshot);
        }
      },

      async savePrompt(base, draft, force = false) {
        const result = await attempt("Couldn't save the prompt.", (vault) =>
          vault.save(base, draft, { force }),
        );
        if (result?.status === "saved") showSnapshot(result.snapshot);
        return result;
      },

      async copyText(text, promptId) {
        try {
          await navigator.clipboard.writeText(text);
        } catch (error) {
          const reason =
            error instanceof DOMException && error.name === "NotAllowedError"
              ? "The browser blocked the clipboard. Click the page and try again."
              : error instanceof Error
                ? error.message
                : "The browser refused.";
          toast.error(`Couldn't copy. ${reason}`);
          return false;
        }

        toast("Prompt copied");
        if (promptId) {
          noteUse(promptId);
          setLastCopy({ promptId, at: Date.now() });
        }
        return true;
      },

      async reassignModel(from, to) {
        const snapshot = await attempt("Couldn't move the prompts.", (vault) =>
          vault.reassignModel(from, to),
        );
        if (snapshot) showSnapshot(snapshot);
      },

      async setFavorite(id, favorite) {
        const snapshot = await attempt("Couldn't update the prompt.", (vault) =>
          vault.setFavorite(id, favorite),
        );
        if (snapshot) showSnapshot(snapshot);
      },

      async deletePrompt(id) {
        const result = await attempt("Couldn't delete the prompt.", (vault) =>
          vault.moveToTrash(id),
        );
        if (!result) return;

        showSnapshot(result.snapshot);
        toast("Moved to trash", {
          action: { label: "Undo", onClick: () => void restoreFromTrash(result.trashName) },
        });
      },

      restoreFromTrash,

      async listTrash() {
        return (await attempt("Couldn't read the trash.", (vault) => vault.listTrash())) ?? [];
      },

      async emptyTrash() {
        await attempt("Couldn't empty the trash.", (vault) => vault.emptyTrash());
      },

      async listHistory(id) {
        const versions = await attempt("Couldn't read the history.", (vault) =>
          vault.listHistory(id),
        );
        return versions ?? [];
      },

      async saveSettings(settings) {
        const snapshot = await attempt("Couldn't save the settings.", (vault) =>
          vault.saveSettings(settings),
        );
        if (snapshot) showSnapshot(snapshot);
      },
    };
  }, [attempt, connect, noteUse, refresh, showSnapshot, writeUsage]);

  const value = useMemo(() => ({ ...actions, state, lastCopy }), [actions, state, lastCopy]);
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const value = useContext(VaultContext);
  if (!value) throw new Error("useVault must be used inside VaultProvider");
  return value;
}
