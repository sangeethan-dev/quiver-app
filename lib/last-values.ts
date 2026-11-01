const KEY_PREFIX = "quiver.values.";

/** What was last typed into a prompt's form. A convenience only, so failures are ignored. */
export function loadLastValues(promptId: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY_PREFIX + promptId) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string"),
    );
  } catch {
    return {};
  }
}

export function saveLastValues(promptId: string, values: Readonly<Record<string, string>>): void {
  try {
    localStorage.setItem(KEY_PREFIX + promptId, JSON.stringify(values));
  } catch {
    // Storage is blocked or full; the form just won't be prefilled next time.
  }
}
