import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_FOLDERS = ["app", "components", "lib", "tests", "public", ".github"];

function filesIn(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).replaceAll("\\", "/"));
}

function ignoredAmong(paths: string[]): string[] {
  const { stdout } = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], {
    input: paths.join("\n"),
    encoding: "utf8",
  });
  return stdout.split("\n").filter(Boolean);
}

describe(".gitignore", () => {
  // A broad pattern once matched components/vault/. The app built locally, because
  // the files were on disk, while the commit left them out and the deploy failed.
  // Tailwind skips gitignored paths too, so the same mistake also loses their styles.
  it("doesn't ignore any source file", () => {
    const files = SOURCE_FOLDERS.flatMap(filesIn);
    expect(files.length).toBeGreaterThan(0);
    expect(ignoredAmong(files)).toEqual([]);
  });

  it.each(["Quiver/prompt.md", "vault/prompt.md", "some/folder/vault/prompt.md", "notes.local.md"])(
    "still keeps %s out of the repo",
    (path) => {
      expect(ignoredAmong([path])).toEqual([path]);
    },
  );
});
