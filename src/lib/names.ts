const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "eng", "eng.", "mx", "sir", "madam", "د", "م", "أ"]);

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const LETTERS = /\p{L}/u;
const VALID_NAME = /^[\p{L}][\p{L}'’\-.]*$/u;

/** A usable given name: at least 2 letters, no digits/emoji/symbols, not a bare initial. */
export function isValidGivenName(name: string): boolean {
  const n = clean(name).replace(/\.$/, "");
  if (n.length < 2) return false;
  if (!VALID_NAME.test(n)) return false;
  const letters = [...n].filter((c) => LETTERS.test(c)).length;
  return letters >= 2;
}

/**
 * Returns the first name to greet with, or null if it cannot be determined reliably.
 * Never invents a name; callers must flag the contact for manual review when null.
 */
export function extractFirstName(firstName: string | undefined | null, fullName?: string | null): string | null {
  const candidates: string[] = [];
  if (firstName) candidates.push(clean(firstName));
  if (fullName) candidates.push(clean(fullName));
  for (const raw of candidates) {
    const tokens = raw.split(" ").filter(Boolean);
    while (tokens.length && HONORIFICS.has((tokens[0] ?? "").toLowerCase().replace(/\.$/, ""))) tokens.shift();
    const first = tokens[0];
    if (first && isValidGivenName(first)) return first.replace(/\.$/, "");
  }
  return null;
}

export function buildFullName(first: string, last: string): string {
  return clean(`${first} ${last}`);
}
