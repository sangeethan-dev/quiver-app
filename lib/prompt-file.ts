import { Document, isCollection, isMap, isScalar, isSeq, parseDocument } from "yaml";
import { isValidId } from "@/lib/id";

export interface PromptMeta {
  id: string;
  title: string;
  model: string;
  tags: string[];
  favorite: boolean;
  version: number;
  created: string;
  updated: string;
  lastUsed?: string;
  useCount: number;
}

/** The file's own text, kept so writing it back changes only what was edited. */
export interface PromptFileSource {
  /** Opening `---` line, with any byte order mark and its line ending. */
  opening: string;
  frontMatter: string;
  /** Closing `---` line with its line ending, if it has one. */
  closing: string;
}

export interface Prompt extends PromptMeta {
  body: string;
  source?: PromptFileSource;
}

export type ParseResult = { ok: true; prompt: Prompt } | { ok: false; error: string };

const UNTITLED = "Untitled";

const META_KEYS = [
  "id",
  "title",
  "model",
  "tags",
  "favorite",
  "version",
  "created",
  "updated",
  "lastUsed",
  "useCount",
] as const satisfies readonly (keyof PromptMeta)[];

const YAML_OPTIONS = { lineWidth: 0, flowCollectionPadding: false };

function splitFile(text: string): (PromptFileSource & { body: string }) | null {
  const opening = /^﻿?---[ \t]*\r?\n/.exec(text)?.[0];
  if (!opening) return null;

  let lineStart = opening.length;
  for (;;) {
    const newline = text.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? text.length : newline + 1;
    const line = text.slice(lineStart, lineEnd);

    if (/^---[ \t]*\r?\n?$/.test(line)) {
      return {
        opening,
        frontMatter: text.slice(opening.length, lineStart),
        closing: line,
        body: text.slice(lineEnd),
      };
    }
    if (newline === -1) return null;
    lineStart = lineEnd;
  }
}

// Reads the written text, so `title: 1.10` stays "1.10" and isn't turned into a number.
function readText(doc: Document, key: string): string | undefined {
  const node = doc.get(key, true);
  if (!isScalar(node) || node.value === null) return undefined;
  return node.source ?? String(node.value);
}

function readInteger(doc: Document, key: string, minimum: number, fallback: number): number {
  const node = doc.get(key, true);
  const value = isScalar(node) ? node.value : undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= minimum
    ? value
    : fallback;
}

function readTags(doc: Document): string[] {
  const node = doc.get("tags", true);
  if (isScalar(node)) {
    const tag = readText(doc, "tags");
    return tag ? [tag] : [];
  }
  if (!isSeq(node)) return [];
  return node.items.flatMap((item) =>
    isScalar(item) && item.value !== null ? [item.source ?? String(item.value)] : [],
  );
}

// Lenient by design: a hand-edited field that's missing or wrong gets a default,
// so one typo in Notepad doesn't lose the prompt. Only `id` is required.
function readMeta(doc: Document): PromptMeta {
  const favorite = doc.get("favorite", true);
  return {
    id: readText(doc, "id") ?? "",
    title: readText(doc, "title") || UNTITLED,
    model: readText(doc, "model") ?? "",
    tags: readTags(doc),
    favorite: isScalar(favorite) && favorite.value === true,
    version: readInteger(doc, "version", 1, 1),
    created: readText(doc, "created") ?? "",
    updated: readText(doc, "updated") ?? "",
    lastUsed: readText(doc, "lastUsed"),
    useCount: readInteger(doc, "useCount", 0, 0),
  };
}

export function parsePromptFile(text: string): ParseResult {
  const parts = splitFile(text);
  if (!parts) return { ok: false, error: "No front matter found" };

  const { body, ...source } = parts;

  let doc: Document;
  try {
    doc = parseDocument(source.frontMatter);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid front matter" };
  }

  if (doc.errors.length > 0) {
    return { ok: false, error: doc.errors[0].message.split("\n")[0] };
  }
  if (!isMap(doc.contents)) return { ok: false, error: "Front matter is not a list of fields" };

  const meta = readMeta(doc);
  if (!meta.id) return { ok: false, error: "Front matter has no id" };
  if (!isValidId(meta.id)) {
    return { ok: false, error: `Invalid id "${meta.id}": expected 6 lowercase letters or numbers` };
  }

  return { ok: true, prompt: { ...meta, body, source } };
}

function sameValue(a: PromptMeta[keyof PromptMeta], b: PromptMeta[keyof PromptMeta]): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

function writeMeta(doc: Document, prompt: PromptMeta, before?: PromptMeta): void {
  for (const key of META_KEYS) {
    const value = prompt[key];
    if (before && sameValue(value, before[key])) continue;

    if (value === undefined) {
      doc.delete(key);
    } else if (key === "tags") {
      const previous = doc.get(key, true);
      const tags = doc.createNode(prompt.tags);
      tags.flow = isCollection(previous) ? previous.flow : true;
      doc.set(key, tags);
    } else {
      doc.set(key, value);
    }
  }
}

function renderFrontMatter(prompt: Prompt): string {
  if (!prompt.source) {
    const doc = new Document({});
    writeMeta(doc, prompt);
    return doc.toString(YAML_OPTIONS);
  }

  const { frontMatter, opening } = prompt.source;
  const doc = parseDocument(frontMatter) as unknown as Document;
  const before = readMeta(doc);
  if (META_KEYS.every((key) => sameValue(prompt[key], before[key]))) return frontMatter;

  writeMeta(doc, prompt, before);
  const rendered = doc.toString(YAML_OPTIONS);
  return opening.endsWith("\r\n") ? rendered.replace(/\n/g, "\r\n") : rendered;
}

/**
 * A parsed prompt writes back byte for byte. After an edit, only the changed
 * fields are rewritten: comments, extra fields and the file's line endings stay.
 */
export function serializePromptFile(prompt: Prompt): string {
  const frontMatter = renderFrontMatter(prompt);
  const opening = prompt.source?.opening ?? "---\n";
  const closing = prompt.source?.closing ?? "---\n";

  const needsLineBreak = prompt.body && !closing.endsWith("\n");
  const lineBreak = needsLineBreak ? (opening.endsWith("\r\n") ? "\r\n" : "\n") : "";
  return `${opening}${frontMatter}${closing}${lineBreak}${prompt.body}`;
}
