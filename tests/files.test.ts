import { describe, expect, it } from "vitest";
import {
  decodeText,
  describeFileError,
  isNotFoundError,
  isPermissionError,
} from "@/lib/fs/files";

const domError = (name: string) => new DOMException("technical detail", name);

describe("describeFileError", () => {
  it.each([
    ["NotAllowedError", "permission"],
    ["SecurityError", "permission"],
    ["NotFoundError", "no longer exists"],
    ["NoModificationAllowedError", "locked"],
    ["InvalidStateError", "locked"],
    ["NotReadableError", "couldn't be read"],
    ["QuotaExceededError", "disk space"],
    ["TypeMismatchError", "same name"],
    ["AbortError", "interrupted"],
  ])("explains %s in plain words", (name, phrase) => {
    expect(describeFileError(domError(name))).toContain(phrase);
  });

  it("never shows a browser's technical text for other file errors", () => {
    expect(describeFileError(domError("SomeNewError"))).not.toContain("technical detail");
  });

  it("keeps messages written by the app", () => {
    expect(describeFileError(new Error("This prompt no longer exists."))).toBe(
      "This prompt no longer exists.",
    );
  });

  it("handles something that isn't an error", () => {
    expect(describeFileError("oops")).toBe("Something went wrong.");
  });
});

describe("error checks", () => {
  it("recognises a missing file or folder", () => {
    expect(isNotFoundError(domError("NotFoundError"))).toBe(true);
    expect(isNotFoundError(domError("AbortError"))).toBe(false);
    expect(isNotFoundError(new Error("NotFoundError"))).toBe(false);
  });

  it("recognises lost permission", () => {
    expect(isPermissionError(domError("NotAllowedError"))).toBe(true);
    expect(isPermissionError(domError("SecurityError"))).toBe(true);
    expect(isPermissionError(domError("NotFoundError"))).toBe(false);
  });
});

describe("decodeText", () => {
  const bytes = (...values: number[]) => new Uint8Array(values).buffer;

  it("reads UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("கட்டுரை").buffer as ArrayBuffer)).toBe("கட்டுரை");
  });

  it("keeps a byte order mark, so the file writes back unchanged", () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x61))).toBe("﻿a");
  });

  it("refuses bytes that aren't UTF-8, rather than damaging the file on save", () => {
    expect(() => decodeText(bytes(0x63, 0xe9))).toThrow(TypeError);
  });
});
