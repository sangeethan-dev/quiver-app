const MAX_SLUG_LENGTH = 60;
const FALLBACK_SLUG = "prompt";

/**
 * A filename-safe slug. Letters from any script are kept, and only Latin accents
 * are stripped: combining marks are vowel signs in scripts such as Tamil.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  const truncated = Array.from(slug).slice(0, MAX_SLUG_LENGTH).join("").replace(/-+$/, "");
  return truncated || FALLBACK_SLUG;
}

/** The filename is cosmetic; the `id` in the front matter is the prompt's identity. */
export function promptFileName(title: string, id: string): string {
  return `${slugify(title)}--${id}.md`;
}
