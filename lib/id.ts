const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const ALPHANUMERIC = `${LETTERS}0123456789`;
const ID_LENGTH = 6;

function randomCharacter(characters: string): string {
  // Rejection sampling: keeping only bytes below a multiple of the alphabet size avoids bias.
  const limit = 256 - (256 % characters.length);
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= limit);
  return characters[byte[0] % characters.length];
}

/**
 * A short random id, unique among `existing`. The first character is always a
 * letter, so an id can never read as a number in YAML (e.g. 123456 or 1e5000).
 */
export function generateId(existing?: ReadonlySet<string>): string {
  let id: string;
  do {
    id = randomCharacter(LETTERS);
    while (id.length < ID_LENGTH) id += randomCharacter(ALPHANUMERIC);
  } while (existing?.has(id));
  return id;
}

/** The id is used as a folder name under `_history`, so hand-edited values must be checked. */
export function isValidId(id: string): boolean {
  return /^[a-z0-9]{6}$/.test(id);
}
