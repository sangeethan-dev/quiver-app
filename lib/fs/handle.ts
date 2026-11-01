import { get, set } from "idb-keyval";

const FOLDER_KEY = "vault-folder";
const READ_WRITE = { mode: "readwrite" } as const;

export function isFolderAccessSupported(): boolean {
  return "showDirectoryPicker" in window;
}

export async function loadStoredFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await get<FileSystemDirectoryHandle>(FOLDER_KEY)) ?? null;
  } catch {
    return null;
  }
}

/** Returns null if the picker was cancelled. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  let folder: FileSystemDirectoryHandle;
  try {
    folder = await window.showDirectoryPicker({ id: "quiver", mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }

  // Without storage the folder still works; it just has to be chosen again next visit.
  await set(FOLDER_KEY, folder).catch(() => undefined);
  return folder;
}

export function queryFolderPermission(folder: FileSystemDirectoryHandle): Promise<PermissionState> {
  return folder.queryPermission(READ_WRITE);
}

/** Must be called from a click: the browser shows its prompt only for a user gesture. */
export function requestFolderPermission(
  folder: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  return folder.requestPermission(READ_WRITE);
}

export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}
