import { describe, expect, it } from "vitest";
import { parsePromptFile, serializePromptFile, type Prompt } from "@/lib/prompt-file";

const BRIEF_EXAMPLE = `---
id: k3f9a2
title: Rewrite · tone & register
model: claude
tags: [writing, email]
favorite: true
version: 3
created: 2026-11-01T08:30:00+05:30
updated: 2026-11-03T14:12:00+05:30
lastUsed: 2026-11-04T09:01:00+05:30
useCount: 12
---
Rewrite the text below in a {{tone|friendly}} tone for {{audience}}.
Keep it under {{length|150}} words.

Text:
{{text}}
`;

const MINIMAL = "---\nid: abc123\n---\nBody\n";

function parse(text: string): Prompt {
  const result = parsePromptFile(text);
  if (!result.ok) throw new Error(result.error);
  return result.prompt;
}

function failure(text: string): string {
  const result = parsePromptFile(text);
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.error;
}

function withoutSource(prompt: Prompt): Prompt {
  const copy = { ...prompt };
  delete copy.source;
  return copy;
}

const fresh: Prompt = {
  id: "abc123",
  title: "A title",
  model: "claude",
  tags: ["one"],
  favorite: false,
  version: 1,
  created: "2026-11-01T08:30:00+05:30",
  updated: "2026-11-01T08:30:00+05:30",
  useCount: 0,
  body: "Body\n",
};

describe("parsePromptFile", () => {
  it("reads every field of the example from the brief", () => {
    expect(withoutSource(parse(BRIEF_EXAMPLE))).toEqual({
      id: "k3f9a2",
      title: "Rewrite · tone & register",
      model: "claude",
      tags: ["writing", "email"],
      favorite: true,
      version: 3,
      created: "2026-11-01T08:30:00+05:30",
      updated: "2026-11-03T14:12:00+05:30",
      lastUsed: "2026-11-04T09:01:00+05:30",
      useCount: 12,
      body:
        "Rewrite the text below in a {{tone|friendly}} tone for {{audience}}.\n" +
        "Keep it under {{length|150}} words.\n\nText:\n{{text}}\n",
    });
  });

  it("keeps timestamps as the text that was written", () => {
    expect(parse("---\nid: abc123\ncreated: 2026-11-01\n---\n").created).toBe("2026-11-01");
  });

  it("does not treat a --- line in the body as a delimiter", () => {
    const body = "Before\n---\nAfter\n---\n";
    expect(parse(`---\nid: abc123\n---\n${body}`).body).toBe(body);
  });

  it("does not mistake an indented --- in the front matter for the closing line", () => {
    const prompt = parse("---\nid: abc123\ntitle: |\n  ---\n  x\n---\nBody");
    expect(prompt.title).toBe("---\nx\n");
    expect(prompt.body).toBe("Body");
  });

  it("keeps the body exactly as written", () => {
    const body = "\n\n  indented\t\r\nmixed\nendings   \n\n\n";
    expect(parse(`---\nid: abc123\n---\n${body}`).body).toBe(body);
  });

  it("allows an empty body", () => {
    expect(parse("---\nid: abc123\n---\n").body).toBe("");
    expect(parse("---\nid: abc123\n---").body).toBe("");
  });

  it("reads files saved by Notepad with CRLF and a byte order mark", () => {
    const prompt = parse("﻿---\r\nid: abc123\r\ntitle: Hi\r\n---\r\nBody\r\n");
    expect(prompt.id).toBe("abc123");
    expect(prompt.title).toBe("Hi");
    expect(prompt.body).toBe("Body\r\n");
  });

  it("allows trailing spaces on the delimiter lines", () => {
    expect(parse("---  \nid: abc123\n--- \t\nBody").body).toBe("Body");
  });

  describe("hand-edited fields", () => {
    it("fills in everything except the id", () => {
      expect(withoutSource(parse("---\nid: abc123\n---\n"))).toEqual({
        id: "abc123",
        title: "Untitled",
        model: "",
        tags: [],
        favorite: false,
        version: 1,
        created: "",
        updated: "",
        useCount: 0,
        body: "",
      });
    });

    it("ignores values of the wrong type", () => {
      const prompt = parse(
        "---\nid: abc123\nmodel: [a]\ntags: {a: 1}\nfavorite: yes\nversion: two\nuseCount: -3\n---\n",
      );
      expect(prompt).toMatchObject({
        model: "",
        tags: [],
        favorite: false,
        version: 1,
        useCount: 0,
      });
    });

    it("does not accept a version below 1 or a fractional count", () => {
      expect(parse("---\nid: abc123\nversion: 0\n---\n").version).toBe(1);
      expect(parse("---\nid: abc123\nuseCount: 1.5\n---\n").useCount).toBe(0);
    });

    it("treats empty values as missing", () => {
      const prompt = parse("---\nid: abc123\ntitle:\nmodel: ~\ntags:\nlastUsed:\n---\n");
      expect(prompt).toMatchObject({ title: "Untitled", model: "", tags: [] });
      expect(prompt.lastUsed).toBeUndefined();
    });

    it("keeps titles and tags that look like numbers as written", () => {
      const prompt = parse("---\nid: abc123\ntitle: 1.10\ntags: [2026, 007, true]\n---\n");
      expect(prompt.title).toBe("1.10");
      expect(prompt.tags).toEqual(["2026", "007", "true"]);
    });

    it("accepts a single tag written without brackets", () => {
      expect(parse("---\nid: abc123\ntags: writing\n---\n").tags).toEqual(["writing"]);
    });

    it("accepts tags written as a block list", () => {
      expect(parse("---\nid: abc123\ntags:\n  - a\n  - b\n---\n").tags).toEqual(["a", "b"]);
    });

    it("reads an all-digit id as text", () => {
      expect(parse("---\nid: 001234\n---\n").id).toBe("001234");
    });

    it("ignores aliases instead of expanding them", () => {
      const prompt = parse("---\nid: abc123\nx: &a Title\ntitle: *a\n---\n");
      expect(prompt.title).toBe("Untitled");
    });
  });

  describe("files that can't be read", () => {
    it.each([
      ["an empty file", ""],
      ["plain text", "Just some notes\n"],
      ["a Markdown heading", "# Title\n\nText\n"],
      ["text before the front matter", "\n---\nid: abc123\n---\n"],
      ["no closing line", "---\nid: abc123\ntitle: x\n"],
      ["only an opening line", "---"],
    ])("%s", (_label, text) => {
      expect(failure(text)).toBe("No front matter found");
    });

    it("rejects invalid YAML with a one-line reason", () => {
      const error = failure("---\nid: abc123\ntitle: [unclosed\n---\n");
      expect(error).not.toBe("");
      expect(error).not.toContain("\n");
    });

    it("rejects duplicate keys", () => {
      expect(failure("---\nid: abc123\nid: def456\n---\n")).toMatch(/unique/i);
    });

    it("rejects front matter that isn't key-value pairs", () => {
      expect(failure("---\n- a\n- b\n---\n")).toBe("Front matter is not a list of fields");
      expect(failure("---\njust text\n---\n")).toBe("Front matter is not a list of fields");
      expect(failure("---\n---\n")).toBe("Front matter is not a list of fields");
    });

    it("rejects a missing id", () => {
      expect(failure("---\ntitle: x\n---\n")).toBe("Front matter has no id");
    });

    it.each(["abc", "ABCDEF", "../../x", "abc def"])("rejects the id %j", (id) => {
      expect(failure(`---\nid: ${JSON.stringify(id)}\n---\n`)).toContain("Invalid id");
    });

    it("never throws on binary-looking input", () => {
      const inputs = ["\u0000\u0001---", "---\n\u0000\n---\n", "---\n%YAML 9\n---\n", "---\n!!!\n---"];
      for (const input of inputs) {
        expect(() => parsePromptFile(input)).not.toThrow();
      }
    });
  });
});

describe("round trip", () => {
  it.each([
    ["the example from the brief", BRIEF_EXAMPLE],
    ["a minimal file", MINIMAL],
    ["CRLF line endings", "---\r\nid: abc123\r\ntitle: Hi\r\n---\r\nBody\r\nMore\r\n"],
    ["a byte order mark", "﻿---\nid: abc123\n---\nBody\n"],
    ["no newline at the end", "---\nid: abc123\n---\nBody"],
    ["nothing after the closing line", "---\nid: abc123\n---"],
    ["spaces after the delimiters", "--- \nid: abc123\n---\t\nBody\n"],
    ["comments", "---\n# top\nid: abc123 # the id\n\n# gap\ntitle: Hi\n---\nBody\n"],
    ["unknown fields", "---\nid: abc123\nauthor: me\nnested: {a: [1, 2]}\n---\nBody\n"],
    ["unusual key order", "---\nuseCount: 1\ntitle: Hi\nid: abc123\n---\nBody\n"],
    ["unusual quoting", `---\nid: 'abc123'\ntitle: "Hi"\ntags: [ 'a',   "b" ]\n---\nBody\n`],
    ["block style tags", "---\nid: abc123\ntags:\n  - a\n  - b\n---\nBody\n"],
    ["fields that need defaults", "---\nid: abc123\nversion: nope\ntags: {}\n---\nBody\n"],
    ["a --- line in the body", "---\nid: abc123\n---\na\n---\nb\n"],
    ["whitespace-heavy body", "---\nid: abc123\n---\n\n  \t\n\r\nx  \n\n"],
    ["a long title", `---\nid: abc123\ntitle: ${"word ".repeat(40)}end\n---\n`],
  ])("does not change %s", (_label, text) => {
    expect(serializePromptFile(parse(text))).toBe(text);
  });

  it("stays identical over repeated rounds", () => {
    const once = serializePromptFile(parse(BRIEF_EXAMPLE));
    const twice = serializePromptFile(parse(once));
    expect(twice).toBe(BRIEF_EXAMPLE);
  });
});

describe("serializePromptFile", () => {
  describe("a new prompt", () => {
    it("writes the format from the brief", () => {
      expect(serializePromptFile(withoutSource(parse(BRIEF_EXAMPLE)))).toBe(BRIEF_EXAMPLE);
    });

    it("leaves out lastUsed until the prompt has been used", () => {
      const text = serializePromptFile(fresh);
      expect(text).not.toContain("lastUsed");
      expect(text).toContain("useCount: 0\n---\nBody\n");
    });

    it("writes empty tags in a readable form", () => {
      expect(serializePromptFile({ ...fresh, tags: [] })).toContain("tags: []\n");
    });

    it("keeps a long title on one line", () => {
      const title = "word ".repeat(60).trim();
      expect(serializePromptFile({ ...fresh, title })).toContain(`title: ${title}\n`);
    });

    it.each([
      "Plain",
      "Rewrite · tone & register",
      "Colon: inside",
      "Trailing colon:",
      "# starts like a comment",
      "has # hash",
      "& starts like an anchor",
      "* starts like an alias",
      "- starts like a list",
      "[starts like a list",
      "{starts like a map",
      "'single' \"double\"",
      "back\\slash",
      "1.10",
      "true",
      "null",
      "---",
      "கட்டுரை 😀",
    ])("preserves the title %j", (title) => {
      const parsed = parse(serializePromptFile({ ...fresh, title }));
      expect(parsed.title).toBe(title);
    });

    it("preserves tags that need quoting", () => {
      const tags = ["with, comma", "2026", "true", "[x]", "a: b"];
      expect(parse(serializePromptFile({ ...fresh, tags })).tags).toEqual(tags);
    });

    it("quotes an all-digit id so it stays text", () => {
      const text = serializePromptFile({ ...fresh, id: "000123" });
      expect(parse(text).id).toBe("000123");
    });

    it("gives back the same prompt when parsed", () => {
      const parsed = parse(serializePromptFile(fresh));
      expect(withoutSource(parsed)).toEqual(fresh);
    });

    it("preserves a body that looks like front matter", () => {
      const body = "---\nid: other1\n---\nNested\n";
      expect(parse(serializePromptFile({ ...fresh, body })).body).toBe(body);
    });
  });

  describe("an edited prompt", () => {
    const annotated =
      "---\n# my favourite\nid: abc123\ntitle: 'Old' # why\nauthor: me\nmodel: claude\n" +
      "tags: [a, b]\nversion: 2\nuseCount: 5\n---\nBody\n";

    it("changes only the edited field", () => {
      const prompt = parse(annotated);
      expect(serializePromptFile({ ...prompt, useCount: 6 })).toBe(
        annotated.replace("useCount: 5", "useCount: 6"),
      );
    });

    it("keeps the quoting style of an edited field", () => {
      const prompt = parse(annotated);
      expect(serializePromptFile({ ...prompt, title: "New" })).toContain("title: 'New' # why\n");
    });

    it("keeps comments and unknown fields", () => {
      const output = serializePromptFile({ ...parse(annotated), favorite: true });
      expect(output).toContain("# my favourite\n");
      expect(output).toContain("author: me\n");
      expect(output).toContain("favorite: true\n");
    });

    it("changes only the body when the body is edited", () => {
      const prompt = parse(annotated);
      expect(serializePromptFile({ ...prompt, body: "New\n" })).toBe(
        annotated.replace("Body\n", "New\n"),
      );
    });

    it("keeps CRLF and the byte order mark", () => {
      const text = "﻿---\r\nid: abc123\r\nuseCount: 1\r\n---\r\nBody\r\n";
      expect(serializePromptFile({ ...parse(text), useCount: 2 })).toBe(
        text.replace("useCount: 1", "useCount: 2"),
      );
    });

    it("adds a field that wasn't in the file", () => {
      const output = serializePromptFile({ ...parse(MINIMAL), lastUsed: "2026-11-04T09:01:00Z" });
      expect(output).toBe("---\nid: abc123\nlastUsed: 2026-11-04T09:01:00Z\n---\nBody\n");
    });

    it("removes a field that was cleared", () => {
      const prompt = parse("---\nid: abc123\nlastUsed: 2026-11-04\n---\n");
      expect(serializePromptFile({ ...prompt, lastUsed: undefined })).toBe("---\nid: abc123\n---\n");
    });

    it("keeps inline tags inline and block tags as a block", () => {
      const inline = parse("---\nid: abc123\ntags: [a]\n---\n");
      expect(serializePromptFile({ ...inline, tags: ["a", "b"] })).toContain("tags: [a, b]\n");

      const block = parse("---\nid: abc123\ntags:\n  - a\n---\n");
      expect(serializePromptFile({ ...block, tags: ["a", "b"] })).toContain("tags:\n  - a\n  - b\n");
    });

    it("does not write defaults for fields the user never touched", () => {
      const prompt = parse("---\nid: abc123\nversion: nope\n---\n");
      expect(serializePromptFile({ ...prompt, title: "New" })).toBe(
        "---\nid: abc123\nversion: nope\ntitle: New\n---\n",
      );
    });

    it("starts the body on its own line when the file ended at the closing ---", () => {
      const prompt = parse("---\nid: abc123\n---");
      expect(serializePromptFile({ ...prompt, body: "Body" })).toBe("---\nid: abc123\n---\nBody");
    });

    it("survives a chain of edits", () => {
      let text = annotated;
      for (let useCount = 6; useCount < 9; useCount++) {
        text = serializePromptFile({ ...parse(text), useCount });
      }
      expect(text).toBe(annotated.replace("useCount: 5", "useCount: 8"));
    });
  });
});
