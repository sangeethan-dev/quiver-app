import { describe, expect, it } from "vitest";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { hasVariables } from "@/lib/variables";

describe("EXAMPLE_PROMPTS", () => {
  it("has one for each default model", () => {
    expect(EXAMPLE_PROMPTS.map((prompt) => prompt.model)).toEqual(
      DEFAULT_SETTINGS.models.map((model) => model.id),
    );
  });

  it("labels every example clearly", () => {
    for (const prompt of EXAMPLE_PROMPTS) {
      expect(prompt.title).toMatch(/^Example · /);
      expect(prompt.tags).toContain("example");
    }
  });

  it("shows both a prompt with variables and one without", () => {
    const flags = EXAMPLE_PROMPTS.map((prompt) => hasVariables(prompt.body));
    expect(flags).toContain(true);
    expect(flags).toContain(false);
  });
});
