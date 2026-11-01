// Runs after `next build`. Writes the build's real file list and a version into
// out/sw.js, so the app is complete offline and each deploy replaces the old cache.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_FILES = ["manifest.webmanifest", "favicon.ico"];
const BUILD_LINE = 'const BUILD = "unstamped";';
const PRECACHE_LINE = "const PRECACHE = [];";

/** Everything the app needs to open, as paths relative to the service worker. */
export function shellPaths(files) {
  const assets = files.filter(
    (file) => file.startsWith("_next/static/") || file.startsWith("icons/"),
  );
  return ["./", ...SHELL_FILES.filter((file) => files.includes(file)), ...assets.sort()];
}

/** Changes whenever any file in the shell changes. */
export function buildVersion(entries) {
  const hash = createHash("sha256");
  for (const [path, contents] of entries) hash.update(path).update(contents);
  return hash.digest("hex").slice(0, 12);
}

export function stamp(source, build, paths) {
  // Better a failed build than a worker that quietly caches nothing.
  if (!source.includes(BUILD_LINE) || !source.includes(PRECACHE_LINE)) {
    throw new Error("sw.js no longer has the lines this script stamps.");
  }

  return source
    .replace(BUILD_LINE, `const BUILD = ${JSON.stringify(build)};`)
    .replace(PRECACHE_LINE, `const PRECACHE = ${JSON.stringify(paths)};`);
}

function main() {
  const out = fileURLToPath(new URL("../out", import.meta.url));
  const files = readdirSync(out, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(out, join(entry.parentPath, entry.name)).split(sep).join("/"));

  const paths = shellPaths(files);
  const fileFor = (path) => join(out, path === "./" ? "index.html" : path);
  const version = buildVersion(paths.map((path) => [path, readFileSync(fileFor(path))]));

  const worker = join(out, "sw.js");
  writeFileSync(worker, stamp(readFileSync(worker, "utf8"), version, paths));
  console.log(`Service worker stamped: ${paths.length} files, build ${version}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
