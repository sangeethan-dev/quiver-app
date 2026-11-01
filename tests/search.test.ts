import { describe, expect, it } from "vitest";
import type { Prompt } from "@/lib/prompt-file";
import { createPromptSearch, UNASSIGNED_MODEL_NAME } from "@/lib/search";

const models = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "claude", name: "Claude" },
  { id: "gemini", name: "Gemini" },
];

function prompt(id: string, overrides: Partial<Prompt>): Prompt {
  return {
    id,
    title: "Untitled",
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

const prompts = [
  prompt("rewrit", { title: "Rewrite · tone & register", tags: ["writing", "email"] }),
  prompt("summar", { title: "Summarize · exec brief", model: "chatgpt", tags: ["work"] }),
  prompt("review", {
    title: "Review · pull request",
    model: "gemini",
    body: "Check this diff for correctness and suggest a rewrite where needed.",
  }),
  prompt("orphan", { title: "Translate · French", model: "retired", tags: ["language"] }),
];

const search = createPromptSearch(prompts, models);
const ids = (query: string) => search(query).map((result) => result.id);

describe("createPromptSearch", () => {
  it("returns every prompt in the original order for an empty query", () => {
    expect(ids("")).toEqual(["rewrit", "summar", "review", "orphan"]);
    expect(ids("   ")).toEqual(["rewrit", "summar", "review", "orphan"]);
  });

  it("does not expose the original array", () => {
    expect(search("")).not.toBe(prompts);
  });

  it("finds by title with only a few letters", () => {
    expect(ids("summ")[0]).toBe("summar");
  });

  it("finds by tag", () => {
    expect(ids("language")).toEqual(["orphan"]);
  });

  it("finds by model name, not just the stored id", () => {
    expect(ids("gemini")).toEqual(["review"]);
    expect(ids("ChatGPT")).toEqual(["summar"]);
  });

  it("finds by body text", () => {
    expect(ids("correctness")).toEqual(["review"]);
  });

  it("finds part of a word in the body", () => {
    expect(ids("correctn")).toEqual(["review"]);
  });

  it("tolerates a typo in the body", () => {
    expect(ids("corectness")).toEqual(["review"]);
  });

  it("does not guess from the body for a very short word", () => {
    expect(ids("qz")).toEqual([]);
  });

  it("ignores accents in the body", () => {
    const accented = createPromptSearch([prompt("cafe01", { body: "Meet at the Café" })], models);
    expect(accented("cafe").map((result) => result.id)).toEqual(["cafe01"]);
    expect(accented("café").map((result) => result.id)).toEqual(["cafe01"]);
  });

  it("ranks a title match above a body match", () => {
    expect(ids("rewrite")).toEqual(["rewrit", "review"]);
  });

  it("ranks a fuzzy title match above an exact body match", () => {
    const mixed = createPromptSearch(
      [
        prompt("inbody", { title: "Other", body: "summary of the day" }),
        prompt("intitl", { title: "Summery of notes" }),
      ],
      models,
    );
    expect(mixed("summary").map((result) => result.id)).toEqual(["intitl", "inbody"]);
  });

  it("keeps vault order between equally good matches", () => {
    const same = createPromptSearch(
      [
        prompt("first1", { title: "Other", body: "shared phrase" }),
        prompt("second", { title: "Other", body: "shared phrase" }),
      ],
      models,
    );
    expect(same("phrase").map((result) => result.id)).toEqual(["first1", "second"]);
  });

  it("gives the same answer when a word is repeated from the cache", () => {
    expect(ids("gemini review")).toEqual(ids("gemini review"));
    expect(ids("review gemini")).toEqual(["review"]);
  });

  it("combines a title word with a body word", () => {
    expect(ids("review diff")).toEqual(["review"]);
  });

  it("ignores case", () => {
    expect(ids("SUMMARIZE")[0]).toBe("summar");
  });

  it("tolerates a typo", () => {
    expect(ids("sumarize")[0]).toBe("summar");
    expect(ids("translte")[0]).toBe("orphan");
  });

  it("ignores accents", () => {
    const accented = createPromptSearch([prompt("cafe01", { title: "Café notes" })], models);
    expect(accented("cafe").map((result) => result.id)).toEqual(["cafe01"]);
  });

  it("combines words across fields", () => {
    expect(ids("gemini review")).toEqual(["review"]);
    expect(ids("exec work")).toEqual(["summar"]);
  });

  it("requires every word to match", () => {
    expect(ids("gemini summarize")).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(ids("zzzzqqqq")).toEqual([]);
  });

  it("finds prompts whose model is unknown under Unassigned", () => {
    expect(ids(UNASSIGNED_MODEL_NAME)).toEqual(["orphan"]);
  });

  it("does not mistake search syntax for a query operator", () => {
    expect(() => search("!foo ^bar 'baz$ |")).not.toThrow();
  });

  it("handles an empty vault", () => {
    const empty = createPromptSearch([], models);
    expect(empty("")).toEqual([]);
    expect(empty("anything")).toEqual([]);
  });

  it("stays fast while typing at 1,000 prompts", () => {
    // The budget is about 10x today's worst keystroke so slow CI machines don't fail
    // it, yet well under the 1,000 ms that fuzzy matching whole bodies costs.
    const budgetMs = 300;
    const filler = "draft an outline for the quarterly report and compare options ".repeat(80);
    const vault = Array.from({ length: 1000 }, (_, index) =>
      prompt(`p${index}`, {
        title: `Prompt ${index} · ${index % 2 ? "review notes" : "summary draft"}`,
        tags: ["work", `tag${index % 20}`],
        body: `${filler}${index}`,
      }),
    );

    const large = createPromptSearch(vault, models);
    large("warm up");

    for (const query of ["r", "re", "rev", "review", "review n", "review notes"]) {
      const start = performance.now();
      large(query);
      expect(performance.now() - start).toBeLessThan(budgetMs);
    }
  });
});
