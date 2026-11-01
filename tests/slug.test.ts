import { describe, expect, it } from "vitest";
import { promptFileName, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("matches the file names in the brief", () => {
    expect(slugify("Rewrite · tone & register")).toBe("rewrite-tone-and-register");
    expect(slugify("Summarize · exec brief")).toBe("summarize-exec-brief");
  });

  it("collapses punctuation and trims separators", () => {
    expect(slugify("  --Hello,   world!!  ")).toBe("hello-world");
  });

  it("strips Latin accents", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("keeps letters and vowel signs from other scripts", () => {
    expect(slugify("கட்டுரை சுருக்கம்")).toBe("கட்டுரை-சுருக்கம்");
    expect(slugify("日本語 プロンプト")).toBe("日本語-プロンプト");
  });

  it("removes every character Windows forbids in file names", () => {
    expect(slugify('a<b>c:d"e/f\\g|h?i*j')).toBe("a-b-c-d-e-f-g-h-i-j");
  });

  it("never starts with _ or . so the file is not skipped when listing", () => {
    expect(slugify("_draft")).toBe("draft");
    expect(slugify(".hidden")).toBe("hidden");
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("")).toBe("prompt");
    expect(slugify("··· !!! ···")).toBe("prompt");
  });

  it("limits length without leaving a trailing separator", () => {
    const slug = slugify(`${"a".repeat(59)} ${"b".repeat(40)}`);
    expect(slug).toBe("a".repeat(59));
  });

  it("does not split a character when truncating", () => {
    // 𠮷 takes two UTF-16 units, so the leading "a" puts a unit-based cut mid-character.
    const slug = slugify(`a${"𠮷".repeat(100)}`);
    expect(slug.isWellFormed()).toBe(true);
    expect(Array.from(slug)).toHaveLength(60);
  });
});

describe("promptFileName", () => {
  it("joins the slug and id", () => {
    expect(promptFileName("Rewrite · tone & register", "k3f9a2")).toBe(
      "rewrite-tone-and-register--k3f9a2.md",
    );
  });
});
