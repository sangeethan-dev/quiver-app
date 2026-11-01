/**
 * An in-memory stand-in for the File System Access API. Like the real API, a
 * write only reaches the file on close(), and missing entries reject with a
 * NotFoundError DOMException. It also simulates what happens outside the app.
 */

let clock = 1_000_000;

function notFound(name: string): DOMException {
  return new DOMException(`${name} was not found`, "NotFoundError");
}

class FakeFile {
  readonly kind = "file";
  bytes: Uint8Array<ArrayBuffer> = new Uint8Array();
  lastModified = 0;

  constructor(
    readonly name: string,
    private readonly owner: FakeDirectory,
  ) {}

  async getFile(): Promise<File> {
    this.owner.check("read");
    const file = new File([this.bytes], this.name, { lastModified: this.lastModified });

    // A file can open but fail on read, as a OneDrive placeholder that hasn't synced does.
    const failure = this.owner.failNext;
    if (failure?.action === "content") {
      this.owner.failNext = null;
      file.arrayBuffer = () => Promise.reject(failure.error);
    }
    return file;
  }

  async createWritable() {
    this.owner.check("write");
    const chunks: Uint8Array<ArrayBuffer>[] = [];

    return {
      write: async (chunk: string | Blob) => {
        this.owner.check("write");
        const data =
          typeof chunk === "string"
            ? new TextEncoder().encode(chunk)
            : new Uint8Array(await chunk.arrayBuffer());
        chunks.push(data as Uint8Array<ArrayBuffer>);
      },
      close: async () => {
        this.owner.check("write");
        this.bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        this.lastModified = ++clock;
      },
      abort: async () => undefined,
    };
  }
}

export class FakeDirectory {
  readonly kind = "directory";
  readonly children = new Map<string, FakeFile | FakeDirectory>();
  /** Set to make the next matching operation reject, then clear itself. */
  failNext: { action: "read" | "content" | "write" | "list"; error: DOMException } | null = null;
  removed = false;

  constructor(readonly name = "Quiver") {}

  check(action: "read" | "write" | "list"): void {
    if (this.removed) throw notFound(this.name);
    if (this.failNext?.action === action) {
      const { error } = this.failNext;
      this.failNext = null;
      throw error;
    }
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFile> {
    this.check("list");
    const existing = this.children.get(name);
    if (existing instanceof FakeFile) return existing;
    if (!options?.create) throw notFound(name);

    const file = new FakeFile(name, this);
    this.children.set(name, file);
    return file;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDirectory> {
    this.check("list");
    const existing = this.children.get(name);
    if (existing instanceof FakeDirectory) return existing;
    if (!options?.create) throw notFound(name);

    const directory = new FakeDirectory(name);
    this.children.set(name, directory);
    return directory;
  }

  async removeEntry(name: string): Promise<void> {
    this.check("write");
    if (!this.children.delete(name)) throw notFound(name);
  }

  async *values() {
    this.check("list");
    yield* [...this.children.values()];
  }

  // Test helpers: these act as another program would, bypassing failNext.

  get handle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle;
  }

  put(name: string, contents: string | Uint8Array<ArrayBuffer>): void {
    const file = (this.children.get(name) as FakeFile | undefined) ?? new FakeFile(name, this);
    file.bytes =
      typeof contents === "string"
        ? (new TextEncoder().encode(contents) as Uint8Array<ArrayBuffer>)
        : contents;
    file.lastModified = ++clock;
    this.children.set(name, file);
  }

  read(name: string): string {
    const file = this.children.get(name);
    if (!(file instanceof FakeFile)) throw new Error(`no file named ${name}`);
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.bytes);
  }

  has(name: string): boolean {
    return this.children.has(name);
  }

  /** Every file below this folder as sorted paths, e.g. `_history/abc123/v1.md`. */
  paths(prefix = ""): string[] {
    return [...this.children.entries()]
      .flatMap(([name, child]) =>
        child instanceof FakeDirectory ? child.paths(`${prefix}${name}/`) : [`${prefix}${name}`],
      )
      .sort();
  }

  folder(name: string): FakeDirectory {
    const child = this.children.get(name);
    if (!(child instanceof FakeDirectory)) throw new Error(`no folder named ${name}`);
    return child;
  }
}
