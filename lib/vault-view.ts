import type { Prompt } from "@/lib/prompt-file";
import type { ModelSetting } from "@/lib/settings";

export const SORT_OPTIONS = [
  { id: "recently-used", label: "Recently used" },
  { id: "recently-updated", label: "Recently updated" },
  { id: "title", label: "Title" },
  { id: "most-used", label: "Most used" },
] as const;

export type SortMode = (typeof SORT_OPTIONS)[number]["id"];

export type VaultScope =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "model"; id: string }
  | { kind: "unassigned" };

/** A scope and a tag combine, so "Claude" and "writing" can both be selected. */
export interface VaultFilter {
  scope: VaultScope;
  tag: string | null;
}

export const ALL_PROMPTS: VaultFilter = { scope: { kind: "all" }, tag: null };

export interface VaultCounts {
  all: number;
  favorites: number;
  unassigned: number;
  byModel: ReadonlyMap<string, number>;
}

export interface TagCount {
  tag: string;
  count: number;
}

const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function isSortMode(value: unknown): value is SortMode {
  return SORT_OPTIONS.some((option) => option.id === value);
}

export function findModel(
  models: readonly ModelSetting[],
  id: string,
): ModelSetting | undefined {
  return models.find((model) => model.id === id);
}

function matchesScope(prompt: Prompt, scope: VaultScope, models: readonly ModelSetting[]): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "favorites":
      return prompt.favorite;
    case "model":
      return prompt.model === scope.id;
    case "unassigned":
      return !findModel(models, prompt.model);
  }
}

export function promptsInScope(
  prompts: readonly Prompt[],
  scope: VaultScope,
  models: readonly ModelSetting[],
): Prompt[] {
  return prompts.filter((prompt) => matchesScope(prompt, scope, models));
}

export function filterPrompts(
  prompts: readonly Prompt[],
  { scope, tag }: VaultFilter,
  models: readonly ModelSetting[],
): Prompt[] {
  return promptsInScope(prompts, scope, models).filter(
    (prompt) => tag === null || prompt.tags.includes(tag),
  );
}

function timeOf(value: string | undefined): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** Dates in files can be hand-edited, so anything unparseable just sorts last. */
export function sortPrompts(prompts: readonly Prompt[], mode: SortMode): Prompt[] {
  const byTitle = (a: Prompt, b: Prompt) =>
    titleCollator.compare(a.title, b.title) || (a.id < b.id ? -1 : 1);

  const decorated = prompts.map((prompt) => ({
    prompt,
    used: timeOf(prompt.lastUsed),
    updated: timeOf(prompt.updated),
  }));

  decorated.sort((a, b) => {
    switch (mode) {
      case "recently-used":
        return b.used - a.used || b.updated - a.updated || byTitle(a.prompt, b.prompt);
      case "recently-updated":
        return b.updated - a.updated || byTitle(a.prompt, b.prompt);
      case "title":
        return byTitle(a.prompt, b.prompt);
      case "most-used":
        return b.prompt.useCount - a.prompt.useCount || b.used - a.used || byTitle(a.prompt, b.prompt);
    }
  });

  return decorated.map(({ prompt }) => prompt);
}

export function countPrompts(
  prompts: readonly Prompt[],
  models: readonly ModelSetting[],
): VaultCounts {
  const byModel = new Map<string, number>(models.map((model) => [model.id, 0]));
  let favorites = 0;
  let unassigned = 0;

  for (const prompt of prompts) {
    if (prompt.favorite) favorites++;
    const count = byModel.get(prompt.model);
    if (count === undefined) unassigned++;
    else byModel.set(prompt.model, count + 1);
  }

  return { all: prompts.length, favorites, unassigned, byModel };
}

export function countTags(prompts: readonly Prompt[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => titleCollator.compare(a.tag, b.tag));
}

/** The most recently used prompt, so "Last copied" survives a reload. */
export function latestUse(prompts: readonly Prompt[]): { prompt: Prompt; at: number } | null {
  let latest: { prompt: Prompt; at: number } | null = null;
  for (const prompt of prompts) {
    const at = timeOf(prompt.lastUsed);
    if (at > (latest?.at ?? 0)) latest = { prompt, at };
  }
  return latest;
}

/** The first line with any text, for the list. */
export function firstLine(body: string): string {
  const line = body.split(/\r?\n/).find((text) => text.trim());
  return line?.trim() ?? "";
}
