import Fuse from "fuse.js";
import type { Prompt } from "@/lib/prompt-file";

export const UNASSIGNED_MODEL_NAME = "Unassigned";

export type PromptSearch = (query: string) => Prompt[];

/** Lower is better, keyed by the prompt's position in the vault. */
type Scores = Map<number, number>;

// Fuse's scores stay below 1, so a body hit always ranks after a title, tag or model hit.
const BODY_SCORE = 1;
const MIN_FUZZY_BODY_WORD_LENGTH = 4;
const MAX_CACHED_WORDS = 100;
const BODY_WORD = /[\p{L}\p{M}\p{N}_-]+/gu;
const FUZZY_OPTIONS = { threshold: 0.35, ignoreLocation: true, ignoreDiacritics: true };

function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .toLowerCase();
}

function createBodyWordSearch(bodies: readonly string[]): (word: string) => number[] {
  const promptsByWord = new Map<string, number[]>();

  bodies.forEach((body, index) => {
    for (const word of new Set(body.match(BODY_WORD))) {
      const indexes = promptsByWord.get(word);
      if (indexes) indexes.push(index);
      else promptsByWord.set(word, [index]);
    }
  });

  const fuse = new Fuse([...promptsByWord.keys()], FUZZY_OPTIONS);
  return (word) => fuse.search(word).flatMap((result) => promptsByWord.get(result.item) ?? []);
}

/**
 * Build once per vault change and call the result on every keystroke. An empty
 * query returns every prompt in the given order, so the caller's sort still applies.
 *
 * Every word must match, each in any field. Fuzzy matching whole bodies with Fuse
 * takes around a second at 1,000 prompts, so bodies are scanned for the exact text
 * instead. A word found nowhere is then matched fuzzily against the words used in
 * bodies, which still catches a typo, and that word list is only built if needed.
 */
export function createPromptSearch(
  prompts: readonly Prompt[],
  models: readonly { id: string; name: string }[],
): PromptSearch {
  const modelNames = new Map(models.map((model) => [model.id, model.name]));

  const fieldSearch = new Fuse(
    prompts.map((prompt) => ({
      title: prompt.title,
      tags: prompt.tags,
      modelName: modelNames.get(prompt.model) ?? UNASSIGNED_MODEL_NAME,
    })),
    {
      ...FUZZY_OPTIONS,
      includeScore: true,
      keys: [
        { name: "title", weight: 5 },
        { name: "tags", weight: 2 },
        { name: "modelName", weight: 2 },
      ],
    },
  );

  const bodies = prompts.map((prompt) => foldText(prompt.body));
  let bodyWordSearch: ReturnType<typeof createBodyWordSearch> | undefined;

  const matchWord = (word: string): Scores => {
    const scores: Scores = new Map(
      fieldSearch.search(word).map((result) => [result.refIndex, result.score ?? BODY_SCORE]),
    );

    bodies.forEach((body, index) => {
      if (!scores.has(index) && body.includes(word)) scores.set(index, BODY_SCORE);
    });

    if (scores.size === 0 && word.length >= MIN_FUZZY_BODY_WORD_LENGTH) {
      bodyWordSearch ??= createBodyWordSearch(bodies);
      for (const index of bodyWordSearch(word)) scores.set(index, BODY_SCORE);
    }

    return scores;
  };

  // While typing, earlier words repeat on every keystroke; only the last one is new.
  const cache = new Map<string, Scores>();
  const matchWordCached = (word: string): Scores => {
    const cached = cache.get(word);
    if (cached) return cached;
    if (cache.size >= MAX_CACHED_WORDS) cache.clear();

    const scores = matchWord(word);
    cache.set(word, scores);
    return scores;
  };

  return (query) => {
    const words = foldText(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [...prompts];

    const [first, ...others] = words.map(matchWordCached);
    const totals = new Map(first);
    for (const scores of others) {
      for (const [index, total] of totals) {
        const score = scores.get(index);
        if (score === undefined) totals.delete(index);
        else totals.set(index, total + score);
      }
    }

    return [...totals]
      .sort(([, a], [, b]) => a - b)
      .map(([index]) => prompts[index]);
  };
}
