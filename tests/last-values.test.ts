import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLastValues, saveLastValues } from "@/lib/last-values";

let stored: Map<string, string>;

beforeEach(() => {
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("last values", () => {
  it("gives back what was saved", () => {
    saveLastValues("abc123", { tone: "warm", audience: "the team" });
    expect(loadLastValues("abc123")).toEqual({ tone: "warm", audience: "the team" });
  });

  it("keeps each prompt separate", () => {
    saveLastValues("abc123", { tone: "warm" });
    expect(loadLastValues("def456")).toEqual({});
  });

  it("is empty for a prompt never filled in", () => {
    expect(loadLastValues("abc123")).toEqual({});
  });

  it("ignores stored data that isn't valid", () => {
    stored.set("quiver.values.abc123", "{ not json");
    expect(loadLastValues("abc123")).toEqual({});

    stored.set("quiver.values.abc123", "[1, 2]");
    expect(loadLastValues("abc123")).toEqual({});

    stored.set("quiver.values.abc123", "null");
    expect(loadLastValues("abc123")).toEqual({});
  });

  it("drops values that aren't text", () => {
    stored.set("quiver.values.abc123", '{"a":"yes","b":2,"c":null}');
    expect(loadLastValues("abc123")).toEqual({ a: "yes" });
  });

  it("carries on when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });

    expect(loadLastValues("abc123")).toEqual({});
    expect(() => saveLastValues("abc123", { a: "b" })).not.toThrow();
  });
});
