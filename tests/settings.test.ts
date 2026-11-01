import { describe, expect, it } from "vitest";
import {
  createModel,
  DEFAULT_SETTINGS,
  FALLBACK_MODEL_COLOR,
  parseSettings,
  serializeSettings,
} from "@/lib/settings";

function parsed(text: string) {
  const result = parseSettings(text);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("DEFAULT_SETTINGS", () => {
  it("has the three default models", () => {
    expect(DEFAULT_SETTINGS.models.map((model) => model.id)).toEqual([
      "chatgpt",
      "claude",
      "gemini",
    ]);
  });
});

describe("createModel", () => {
  it("makes an id from the name", () => {
    expect(createModel("Local Llama", []).id).toBe("local-llama");
  });

  it("keeps the name as typed", () => {
    expect(createModel("Local Llama", []).name).toBe("Local Llama");
  });

  it("avoids ids already in use", () => {
    const existing = [
      { id: "new-model", name: "A", color: "#000000" },
      { id: "new-model-2", name: "B", color: "#000000" },
    ];
    expect(createModel("New model", existing).id).toBe("new-model-3");
  });

  it("gives successive models different colors", () => {
    const first = createModel("A", []);
    const second = createModel("B", [first]);
    expect(first.color).not.toBe(second.color);
    expect(first.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("parseSettings", () => {
  it("reads what serializeSettings writes", () => {
    expect(parsed(serializeSettings(DEFAULT_SETTINGS)).settings).toEqual(DEFAULT_SETTINGS);
  });

  it("reads a file saved by Notepad with a byte order mark", () => {
    const text = `﻿${serializeSettings(DEFAULT_SETTINGS)}`;
    expect(parsed(text).settings).toEqual(DEFAULT_SETTINGS);
  });

  it("allows an empty model list", () => {
    expect(parsed('{"models":[]}').settings.models).toEqual([]);
  });

  it("gives an invalid color a neutral fallback", () => {
    const { settings } = parsed('{"models":[{"id":"a","name":"A","color":"red"}]}');
    expect(settings.models[0].color).toBe(FALLBACK_MODEL_COLOR);
  });

  it("gives a missing color a neutral fallback", () => {
    const { settings } = parsed('{"models":[{"id":"a","name":"A"}]}');
    expect(settings.models[0].color).toBe(FALLBACK_MODEL_COLOR);
  });

  it("keeps fields it doesn't know about", () => {
    const { settings, extra } = parsed('{"theme":"dark","models":[]}');
    expect(extra).toEqual({ theme: "dark" });
    expect(JSON.parse(serializeSettings(settings, extra))).toEqual({ theme: "dark", models: [] });
  });

  it.each([
    ["invalid JSON", "{ models: ", "The file isn't valid JSON"],
    ["an empty file", "", "The file isn't valid JSON"],
    ["an array", "[]", 'The file needs a "models" list'],
    ["null", "null", 'The file needs a "models" list'],
    ["models of the wrong type", '{"models":{}}', 'The file needs a "models" list'],
    ["a model without a name", '{"models":[{"id":"a"}]}', "Model 1 needs an id and a name"],
    ["a model that isn't an object", '{"models":["a"]}', "Model 1 needs an id and a name"],
    ["an empty id", '{"models":[{"id":"","name":"A"}]}', "Model 1 needs a unique id"],
    [
      "a repeated id",
      '{"models":[{"id":"a","name":"A"},{"id":"a","name":"B"}]}',
      "Model 2 needs a unique id",
    ],
  ])("rejects %s", (_label, text, error) => {
    expect(parseSettings(text)).toEqual({ ok: false, error });
  });
});

describe("serializeSettings", () => {
  it("writes readable JSON that ends with a newline", () => {
    const text = serializeSettings(DEFAULT_SETTINGS);
    expect(text).toContain('\n  "models": [\n');
    expect(text.endsWith("}\n")).toBe(true);
  });
});
