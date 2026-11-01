export type ShortcutAction =
  | "palette"
  | "new-prompt"
  | "search"
  | "next"
  | "previous"
  | "copy"
  | "favorite"
  | "edit"
  | "delete"
  | "help";

export type PaletteAction =
  | { kind: "favorite" }
  | { kind: "edit" }
  /** Zero-based position of the model chip. */
  | { kind: "filter"; index: number };

interface KeyEvent {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

// Duck-typed so the rules can be tested without a DOM.
interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
}

const SINGLE_KEYS = new Map<string, ShortcutAction>([
  ["n", "new-prompt"],
  ["/", "search"],
  ["arrowdown", "next"],
  ["j", "next"],
  ["arrowup", "previous"],
  ["k", "previous"],
  ["enter", "copy"],
  ["f", "favorite"],
  ["e", "edit"],
  ["delete", "delete"],
  ["?", "help"],
]);

const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

// Dialogs and menus have keys of their own, such as typing a letter to find an item.
const OVERLAY = '[role="dialog"], [role="menu"], [role="listbox"]';

// Enter already activates these. A prompt row is the exception: it selects on click,
// and Enter should copy it, the same as when the list has no focus at all.
const ACTIVATED_BY_ENTER = 'button:not([data-prompt-row]), a, summary, [role="button"]';

function isTextEntry(target: TargetLike | null): boolean {
  return !!target && (TEXT_ENTRY_TAGS.has(target.tagName ?? "") || !!target.isContentEditable);
}

/** The app-wide action for a key press, or null if it should be left alone. */
export function shortcutFor(event: KeyEvent): ShortcutAction | null {
  const key = event.key.toLowerCase();
  const target = event.target as TargetLike | null;

  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === "k") {
    return "palette";
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (isTextEntry(target) || target?.closest?.(OVERLAY)) return null;
  if (key === "enter" && target?.closest?.(ACTIVATED_BY_ENTER)) return null;
  if (event.shiftKey && key !== "?") return null;

  return SINGLE_KEYS.get(key) ?? null;
}

/**
 * Alt shortcuts inside the palette. These read `code`, not `key`, because Alt can
 * change the character a key produces on some keyboard layouts.
 */
export function paletteActionFor(event: KeyEvent): PaletteAction | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;

  if (event.code === "KeyF") return { kind: "favorite" };
  if (event.code === "KeyE") return { kind: "edit" };

  const digit = /^Digit([1-9])$/.exec(event.code ?? "");
  return digit ? { kind: "filter", index: Number(digit[1]) - 1 } : null;
}
