import { describe, expect, it } from "vitest";
import type { Prompt } from "@/lib/prompt-file";
import type { ModelSetting } from "@/lib/settings";
import {
  ALL_PROMPTS,
  countPrompts,
  countTags,
  filterPrompts,
  findModel,
  firstLine,
  isSortMode,
  latestUse,
  promptsInScope,
  SORT_OPTIONS,
  sortPrompts,
} from "@/lib/vault-view";

const models: ModelSetting[] = [
  { id: "claude", name: "Claude", color: "#000000" },
  { id: "gemini", name: "Gemini", color: "#111111" },
];

function prompt(id: string, overrides: Partial<Prompt> = {}): Prompt {
  return {
    id,
    title: id,
    model: "claude",
    tags: [],
    favorite: false,
    version: 1,
    created: "",
    updated: "",
    useCount: 0,
    body: "",
    ...overrides,
  };
}

const ids = (prompts: Prompt[]) => prompts.map((p) => p.id);

describe("filterPrompts", () => {
  const prompts = [
    prompt("a", { tags: ["writing"], favorite: true }),
    prompt("b", { model: "gemini", tags: ["writing", "work"] }),
    prompt("c", { model: "retired" }),
    prompt("d", { model: "" }),
  ];

  it("shows everything by default", () => {
    expect(ids(filterPrompts(prompts, ALL_PROMPTS, models))).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by favorites", () => {
    const filter = { scope: { kind: "favorites" }, tag: null } as const;
    expect(ids(filterPrompts(prompts, filter, models))).toEqual(["a"]);
  });

  it("filters by model", () => {
    const filter = { scope: { kind: "model", id: "gemini" }, tag: null } as const;
    expect(ids(filterPrompts(prompts, filter, models))).toEqual(["b"]);
  });

  it("treats empty and unknown models as unassigned", () => {
    const filter = { scope: { kind: "unassigned" }, tag: null } as const;
    expect(ids(filterPrompts(prompts, filter, models))).toEqual(["c", "d"]);
  });

  it("filters by tag", () => {
    expect(ids(filterPrompts(prompts, { ...ALL_PROMPTS, tag: "writing" }, models))).toEqual([
      "a",
      "b",
    ]);
  });

  it("combines a model and a tag", () => {
    const filter = { scope: { kind: "model", id: "claude" }, tag: "writing" } as const;
    expect(ids(filterPrompts(prompts, filter, models))).toEqual(["a"]);
  });

  it("can match nothing", () => {
    const filter = { scope: { kind: "favorites" }, tag: "work" } as const;
    expect(filterPrompts(prompts, filter, models)).toEqual([]);
  });

  it("lets promptsInScope ignore the tag", () => {
    expect(ids(promptsInScope(prompts, { kind: "unassigned" }, models))).toEqual(["c", "d"]);
  });
});

describe("sortPrompts", () => {
  const prompts = [
    prompt("never", { title: "Banana", updated: "2026-03-01T00:00:00Z" }),
    prompt("older", {
      title: "apple",
      lastUsed: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
      useCount: 9,
    }),
    prompt("newer", {
      title: "Cherry",
      lastUsed: "2026-02-01T00:00:00Z",
      updated: "2026-02-01T00:00:00Z",
      useCount: 2,
    }),
  ];

  it("puts recently used first, then unused prompts by update date", () => {
    expect(ids(sortPrompts(prompts, "recently-used"))).toEqual(["newer", "older", "never"]);
  });

  it("orders several unused prompts by update date, not title", () => {
    const unused = [
      prompt("old", { title: "A", updated: "2026-01-01T00:00:00Z" }),
      prompt("new", { title: "Z", updated: "2026-02-01T00:00:00Z" }),
    ];
    expect(ids(sortPrompts(unused, "recently-used"))).toEqual(["new", "old"]);
  });

  it("sorts by update date", () => {
    expect(ids(sortPrompts(prompts, "recently-updated"))).toEqual(["never", "newer", "older"]);
  });

  it("sorts titles ignoring case", () => {
    expect(ids(sortPrompts(prompts, "title"))).toEqual(["older", "never", "newer"]);
  });

  it("sorts numbers in titles by value", () => {
    const numbered = [prompt("x", { title: "Step 10" }), prompt("y", { title: "Step 2" })];
    expect(ids(sortPrompts(numbered, "title"))).toEqual(["y", "x"]);
  });

  it("sorts by use count", () => {
    expect(ids(sortPrompts(prompts, "most-used"))).toEqual(["older", "newer", "never"]);
  });

  it("breaks ties by title so the order never jumps between renders", () => {
    const tied = [prompt("z", { title: "B" }), prompt("y", { title: "A" })];
    for (const { id } of SORT_OPTIONS) {
      expect(ids(sortPrompts(tied, id))).toEqual(["y", "z"]);
    }
  });

  it("compares offsets by moment, not as text", () => {
    const zones = [
      prompt("early", { updated: "2026-01-01T12:00:00+05:30" }),
      prompt("late", { updated: "2026-01-01T08:00:00+00:00" }),
    ];
    expect(ids(sortPrompts(zones, "recently-updated"))).toEqual(["late", "early"]);
  });

  it("sorts unparseable dates last instead of breaking the order", () => {
    const odd = [prompt("bad", { updated: "next tuesday" }), prompt("good", { updated: "2026-01-01" })];
    expect(ids(sortPrompts(odd, "recently-updated"))).toEqual(["good", "bad"]);
  });

  it("doesn't change the array it was given", () => {
    const original = [...prompts];
    sortPrompts(prompts, "title");
    expect(prompts).toEqual(original);
  });
});

describe("countPrompts", () => {
  it("counts each group", () => {
    const counts = countPrompts(
      [
        prompt("a", { favorite: true }),
        prompt("b", { model: "gemini", favorite: true }),
        prompt("c", { model: "gone" }),
        prompt("d", { model: "" }),
      ],
      models,
    );

    expect(counts).toMatchObject({ all: 4, favorites: 2, unassigned: 2 });
    expect(counts.byModel.get("claude")).toBe(1);
    expect(counts.byModel.get("gemini")).toBe(1);
  });

  it("includes models with no prompts", () => {
    expect(countPrompts([], models).byModel.get("claude")).toBe(0);
  });
});

describe("countTags", () => {
  it("counts tags and sorts them by name", () => {
    expect(
      countTags([prompt("a", { tags: ["work", "Writing"] }), prompt("b", { tags: ["work"] })]),
    ).toEqual([
      { tag: "work", count: 2 },
      { tag: "Writing", count: 1 },
    ]);
  });

  it("is empty when there are no tags", () => {
    expect(countTags([prompt("a")])).toEqual([]);
  });
});

describe("latestUse", () => {
  it("finds the most recently used prompt", () => {
    const latest = latestUse([
      prompt("a", { lastUsed: "2026-01-01T00:00:00Z" }),
      prompt("b", { lastUsed: "2026-03-01T00:00:00Z" }),
      prompt("c"),
    ]);
    expect(latest?.prompt.id).toBe("b");
    expect(latest?.at).toBe(Date.parse("2026-03-01T00:00:00Z"));
  });

  it("is null when nothing has been used", () => {
    expect(latestUse([prompt("a")])).toBeNull();
    expect(latestUse([])).toBeNull();
  });

  it("skips a date it can't read", () => {
    expect(latestUse([prompt("a", { lastUsed: "last week" })])).toBeNull();
  });
});

describe("firstLine", () => {
  it("skips blank lines and trims", () => {
    expect(firstLine("\n\n   \n  Hello there  \nMore")).toBe("Hello there");
  });

  it("handles CRLF", () => {
    expect(firstLine("\r\nHello\r\nMore")).toBe("Hello");
  });

  it("is empty for an empty body", () => {
    expect(firstLine("")).toBe("");
    expect(firstLine("  \n ")).toBe("");
  });
});

describe("findModel", () => {
  it("finds a model by id", () => {
    expect(findModel(models, "gemini")?.name).toBe("Gemini");
    expect(findModel(models, "nope")).toBeUndefined();
  });
});

describe("isSortMode", () => {
  it("accepts known modes only, for values read back from storage", () => {
    expect(isSortMode("title")).toBe(true);
    expect(isSortMode("newest")).toBe(false);
    expect(isSortMode(null)).toBe(false);
  });
});
