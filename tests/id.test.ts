import { afterEach, describe, expect, it, vi } from "vitest";
import { generateId, isValidId } from "@/lib/id";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubRandomBytes(...bytes: number[]) {
  const queue = [...bytes];
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
    (array as Uint8Array)[0] = queue.shift() ?? 0;
    return array;
  });
}

describe("generateId", () => {
  it("produces 6 lowercase alphanumeric characters starting with a letter", () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateId()).toMatch(/^[a-z][a-z0-9]{5}$/);
    }
  });

  it("does not repeat in a realistic sample", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generateId()));
    expect(ids.size).toBe(2000);
  });

  it("skips ids that are already taken", () => {
    // Six zero bytes give "aaaaaa"; the seventh byte starts a different id.
    stubRandomBytes(0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
    expect(generateId(new Set(["aaaaaa"]))).toBe("baaaaa");
  });

  it("discards bytes that would bias the alphabet", () => {
    // 26 letters: bytes 234 to 255 are rejected, so the 1 is what gets used.
    stubRandomBytes(255, 234, 1, 0, 0, 0, 0, 0);
    expect(generateId()).toBe("baaaaa");
  });
});

describe("isValidId", () => {
  it("accepts generated ids and ids from the brief", () => {
    expect(isValidId(generateId())).toBe(true);
    expect(isValidId("k3f9a2")).toBe(true);
    expect(isValidId("123456")).toBe(true);
  });

  it.each(["", "abc", "abcdefg", "ABCDEF", "abc de", "../../x", "ab/cde", "ab.cde"])(
    "rejects %j",
    (id) => {
      expect(isValidId(id)).toBe(false);
    },
  );
});
