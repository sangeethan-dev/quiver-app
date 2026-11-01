import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildVersion, shellPaths, stamp } from "../scripts/stamp-sw.mjs";

const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
const worker = readFileSync("public/sw.js", "utf8");

function pngSize(path: string) {
  const file = readFileSync(path);
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe("manifest", () => {
  it("has what browsers require to offer installing", () => {
    expect(manifest).toMatchObject({
      name: "Quiver",
      short_name: "Quiver",
      display: "standalone",
    });
    expect(manifest.start_url).toBeTruthy();
  });

  it("uses relative URLs, so it works under any base path", () => {
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    for (const icon of manifest.icons) expect(icon.src).not.toMatch(/^(\/|https?:)/);
  });

  it("matches the dark theme", () => {
    expect(manifest.theme_color).toBe("#0d1013");
    expect(manifest.background_color).toBe("#0d1013");
  });

  it("has 192, 512 and a maskable 512", () => {
    const icons = manifest.icons.map((icon: { sizes: string; purpose: string }) => [
      icon.sizes,
      icon.purpose,
    ]);
    expect(icons).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
  });

  it("lists icons that exist at the sizes it claims", () => {
    for (const icon of manifest.icons) {
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(pngSize(`public/${icon.src}`)).toEqual({ width, height });
    }
  });
});

describe("shellPaths", () => {
  const files = [
    "index.html",
    "index.txt",
    "404.html",
    "404/index.html",
    "sw.js",
    ".nojekyll",
    "favicon.ico",
    "manifest.webmanifest",
    "icons/icon-192.png",
    "_next/static/chunks/b.js",
    "_next/static/chunks/a.css",
    "_next/static/media/font.woff2",
  ];

  it("starts with the home page", () => {
    expect(shellPaths(files)[0]).toBe("./");
  });

  it("includes every file the page needs to load", () => {
    expect(shellPaths(files)).toEqual(
      expect.arrayContaining([
        "favicon.ico",
        "manifest.webmanifest",
        "icons/icon-192.png",
        "_next/static/chunks/a.css",
        "_next/static/chunks/b.js",
        "_next/static/media/font.woff2",
      ]),
    );
  });

  it("leaves out files that would fail or aren't needed", () => {
    const paths = shellPaths(files);
    for (const file of ["sw.js", ".nojekyll", "404.html", "404/index.html", "index.txt"]) {
      expect(paths).not.toContain(file);
    }
  });

  it("doesn't list a file the build didn't produce, which would fail the install", () => {
    expect(shellPaths(["_next/static/a.js"])).toEqual(["./", "_next/static/a.js"]);
  });

  it("gives the same order however files are listed", () => {
    expect(shellPaths([...files].reverse())).toEqual(shellPaths(files));
  });
});

describe("buildVersion", () => {
  const entry = (path: string, text: string): [string, Buffer] => [path, Buffer.from(text)];

  it("is stable for the same files", () => {
    const entries = [entry("a", "1"), entry("b", "2")];
    expect(buildVersion(entries)).toBe(buildVersion(entries));
  });

  it("changes when a file's contents change, so each deploy replaces the cache", () => {
    expect(buildVersion([entry("a", "1")])).not.toBe(buildVersion([entry("a", "2")]));
  });

  it("changes when a file is renamed", () => {
    expect(buildVersion([entry("a", "1")])).not.toBe(buildVersion([entry("b", "1")]));
  });
});

describe("stamp", () => {
  it("fills in the real service worker", () => {
    const stamped = stamp(worker, "abc123", ["./", "a.js"]);
    expect(stamped).toContain('const BUILD = "abc123";');
    expect(stamped).toContain('const PRECACHE = ["./","a.js"];');
  });

  it("fails the build if the worker can no longer be stamped", () => {
    expect(() => stamp("const somethingElse = 1;", "abc123", [])).toThrow("no longer has");
    expect(() => stamp('const BUILD = "unstamped";', "abc123", [])).toThrow("no longer has");
  });
});

describe("service worker source", () => {
  it("is on hand for the build", () => {
    expect(existsSync("public/sw.js")).toBe(true);
    expect(existsSync("public/.nojekyll")).toBe(true);
  });

  it("only handles requests inside its own scope", () => {
    expect(worker).toContain("request.url.startsWith(SCOPE)");
    expect(worker).toContain('request.method !== "GET"');
  });
});
