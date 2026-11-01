export function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

export function isPermissionError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

export function describeFileError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Quiver no longer has permission to use this folder.";
      case "NotFoundError":
        return "The file or folder no longer exists.";
      case "NoModificationAllowedError":
        return "The file is locked. Close any program using it and try again.";
      case "NotReadableError":
        return "The file couldn't be read. It may be in use or not fully synced.";
      case "QuotaExceededError":
        return "There isn't enough disk space.";
    }
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Strict UTF-8 that keeps a byte order mark. `Blob.text()` would strip the mark,
 * and non-strict decoding would replace unknown bytes, damaging the file on save.
 */
export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
}

/** Returns the time the file was written, as the browser will report it from now on. */
export async function writeFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  contents: string | Blob,
): Promise<number> {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();

  // Changes only reach the real file on close, so an abort leaves it as it was.
  try {
    await writable.write(contents);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }

  return (await handle.getFile()).lastModified;
}

export async function copyFile(
  from: FileSystemDirectoryHandle,
  name: string,
  to: FileSystemDirectoryHandle,
  newName: string = name,
): Promise<void> {
  const handle = await from.getFileHandle(name);
  await writeFile(to, newName, await handle.getFile());
}

export async function fileExists(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

export async function removeFileIfPresent(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    await directory.removeEntry(name);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
}

/** `name.md`, or `name (2).md` and so on if that's taken. Used so nothing gets overwritten. */
export async function freeFileName(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<string> {
  const stem = name.replace(/\.md$/i, "");
  let candidate = name;
  for (let copy = 2; await fileExists(directory, candidate); copy++) {
    candidate = `${stem} (${copy}).md`;
  }
  return candidate;
}

export async function listFiles(
  directory: FileSystemDirectoryHandle,
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  for await (const handle of directory.values()) {
    if (handle.kind === "file") files.push(handle);
  }
  return files;
}

/** The named subfolder, or null when it hasn't been created yet. */
export async function openSubfolder(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await directory.getDirectoryHandle(name);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}
