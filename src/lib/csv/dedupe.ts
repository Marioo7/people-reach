import { stableHash } from "../utils";
import type { Contact } from "../types";
import type { NormalizedRow } from "./parse";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

type KeyInput = Pick<NormalizedRow, "profileUrl" | "email" | "fullName" | "company">;

/** Ordered list of identity keys: strongest first. Two records match if any key is shared. */
export function identityKeys(r: KeyInput): string[] {
  const keys: string[] = [];
  if (r.profileUrl) keys.push(`url:${r.profileUrl.toLowerCase()}`);
  if (r.email) keys.push(`email:${r.email.toLowerCase()}`);
  const name = norm(r.fullName);
  if (name) keys.push(`name:${name}|${norm(r.company)}`);
  return keys;
}

export const primaryKey = (r: KeyInput): string => identityKeys(r)[0] ?? "";

/** Deterministic id so re-importing the same person always targets the same document. */
export function contactIdFor(ownerId: string, r: KeyInput): string {
  return `ct_${stableHash(`${ownerId}|${primaryKey(r)}`)}`;
}

export interface DedupeResult {
  newRows: NormalizedRow[];
  /** Rows that match an existing contact, paired with that contact. */
  existing: { row: NormalizedRow; contact: Contact }[];
  /** Rows dropped because the same person appeared earlier in the same file. */
  duplicatesInFile: NormalizedRow[];
}

export function dedupeRows(rows: NormalizedRow[], existingContacts: Contact[]): DedupeResult {
  const byKey = new Map<string, Contact>();
  for (const c of existingContacts) {
    for (const k of identityKeys({ profileUrl: c.linkedInProfileUrl, email: c.email, fullName: c.fullName, company: c.company })) {
      if (!byKey.has(k)) byKey.set(k, c);
    }
  }
  const seen = new Set<string>();
  const out: DedupeResult = { newRows: [], existing: [], duplicatesInFile: [] };
  for (const row of rows) {
    const keys = identityKeys(row);
    if (keys.some((k) => seen.has(k))) {
      out.duplicatesInFile.push(row);
      continue;
    }
    keys.forEach((k) => seen.add(k));
    const match = keys.map((k) => byKey.get(k)).find(Boolean);
    if (match) out.existing.push({ row, contact: match });
    else out.newRows.push(row);
  }
  return out;
}
