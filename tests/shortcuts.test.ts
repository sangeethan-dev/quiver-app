import { describe, expect, it } from "vitest";
import { paletteActionFor, shortcutFor } from "@/lib/shortcuts";

function target(tagName: string, matches: string[] = [], isContentEditable = false) {
  return {
    tagName,
    isContentEditable,
    closest: (selector: string) => (matches.some((match) => selector.includes(match)) ? {} : null),
  } as unknown as EventTarget;
}

const body = target("BODY");

function press(key: string, options: Partial<Parameters<typeof shortcutFor>[0]> = {}) {
  return shortcutFor({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: body,
    ...options,
  });
}

describe("shortcutFor", () => {
  it.each([
    ["n", "new-prompt"],
    ["/", "search"],
    ["ArrowDown", "next"],
    ["j", "next"],
    ["ArrowUp", "previous"],
    ["k", "previous"],
    ["Enter", "copy"],
    ["f", "favorite"],
    ["e", "edit"],
    ["Delete", "delete"],
  ])("maps %s", (key, action) => {
    expect(press(key)).toBe(action);
  });

  it("maps ? which is a shifted key", () => {
    expect(press("?", { shiftKey: true })).toBe("help");
  });

  it("works with Caps Lock on", () => {
    expect(press("N")).toBe("new-prompt");
  });

  it("ignores other keys", () => {
    expect(press("x")).toBeNull();
    expect(press("Escape")).toBeNull();
    expect(press("Backspace")).toBeNull();
    expect(press("Tab")).toBeNull();
  });

  describe("Ctrl+K", () => {
    it("opens the palette", () => {
      expect(press("k", { ctrlKey: true })).toBe("palette");
      expect(press("K", { ctrlKey: true })).toBe("palette");
      expect(press("k", { metaKey: true })).toBe("palette");
    });

    it.each(["INPUT", "TEXTAREA", "SELECT"])("works while typing in %s", (tagName) => {
      expect(press("k", { ctrlKey: true, target: target(tagName) })).toBe("palette");
    });

    it("works inside a dialog", () => {
      expect(press("k", { ctrlKey: true, target: target("DIV", ["dialog"]) })).toBe("palette");
    });

    it("leaves other combinations to the browser", () => {
      expect(press("k", { ctrlKey: true, shiftKey: true })).toBeNull();
      expect(press("k", { ctrlKey: true, altKey: true })).toBeNull();
    });
  });

  describe("while typing", () => {
    it.each(["INPUT", "TEXTAREA", "SELECT"])("fires nothing in %s", (tagName) => {
      for (const key of ["n", "/", "j", "k", "e", "f", "Enter", "Delete", "?", "ArrowDown"]) {
        expect(press(key, { target: target(tagName) })).toBeNull();
      }
    });

    it("fires nothing in editable content", () => {
      expect(press("n", { target: target("DIV", [], true) })).toBeNull();
    });
  });

  it.each(["dialog", "menu", "listbox"])("leaves keys to an open %s", (role) => {
    expect(press("n", { target: target("DIV", [role]) })).toBeNull();
    expect(press("ArrowDown", { target: target("DIV", [role]) })).toBeNull();
  });

  it("leaves browser and system combinations alone", () => {
    expect(press("n", { ctrlKey: true })).toBeNull();
    expect(press("f", { ctrlKey: true })).toBeNull();
    expect(press("e", { altKey: true })).toBeNull();
    expect(press("n", { metaKey: true })).toBeNull();
  });

  it("ignores Shift on a plain letter", () => {
    expect(press("N", { shiftKey: true })).toBeNull();
    expect(press("Delete", { shiftKey: true })).toBeNull();
  });

  describe("Enter", () => {
    it("leaves a focused button to activate itself", () => {
      expect(press("Enter", { target: target("BUTTON", ["button:not"]) })).toBeNull();
    });

    it("leaves links and disclosure summaries alone", () => {
      expect(press("Enter", { target: target("A", ["a,"]) })).toBeNull();
      expect(press("Enter", { target: target("SUMMARY", ["summary"]) })).toBeNull();
    });

    it("copies from a focused prompt row, which isn't matched as a button", () => {
      expect(press("Enter", { target: target("BUTTON") })).toBe("copy");
    });

    it("doesn't stop other keys on a focused button", () => {
      expect(press("j", { target: target("BUTTON", ["button:not"]) })).toBe("next");
    });
  });
});

describe("paletteActionFor", () => {
  function palette(code: string, options: Partial<Parameters<typeof paletteActionFor>[0]> = {}) {
    return paletteActionFor({
      key: "",
      code,
      ctrlKey: false,
      metaKey: false,
      altKey: true,
      shiftKey: false,
      target: body,
      ...options,
    });
  }

  it("maps Alt+F and Alt+E", () => {
    expect(palette("KeyF")).toEqual({ kind: "favorite" });
    expect(palette("KeyE")).toEqual({ kind: "edit" });
  });

  it("maps Alt+1 to Alt+9 to chip positions", () => {
    expect(palette("Digit1")).toEqual({ kind: "filter", index: 0 });
    expect(palette("Digit9")).toEqual({ kind: "filter", index: 8 });
  });

  it("ignores Alt+0 and other keys", () => {
    expect(palette("Digit0")).toBeNull();
    expect(palette("KeyQ")).toBeNull();
  });

  it("needs Alt, and only Alt", () => {
    expect(palette("KeyF", { altKey: false })).toBeNull();
    expect(palette("Digit1", { ctrlKey: true })).toBeNull();
    expect(palette("Digit1", { shiftKey: true })).toBeNull();
  });
});
