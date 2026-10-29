import { applyClassification } from "../classify";
import type { Contact, ContactSource, Keyword } from "../types";
import { contactIdFor, dedupeRows } from "./dedupe";
import { isRowImportable, type NormalizedRow } from "./parse";

export interface ImportPlan {
  toCreate: Contact[];
  toUpdate: Contact[];
  unchanged: number;
  duplicatesInFile: number;
  invalid: NormalizedRow[];
}

const FILL_FIELDS = ["firstName", "lastName", "fullName", "jobTitle", "company", "location", "email", "linkedInProfileUrl", "connectedOn"] as const;

function blankContact(ownerId: string, row: NormalizedRow, source: ContactSource, now: string): Contact {
  return {
    id: contactIdFor(ownerId, row),
    ownerId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    jobTitle: row.jobTitle,
    company: row.company,
    location: row.location,
    linkedInProfileUrl: row.profileUrl,
    email: row.email,
    source,
    originalData: row.original,
    matchedKeywords: [],
    matchReason: "",
    classificationStatus: "needs_review",
    reviewStatus: "unreviewed",
    outreachStatus: "not_contacted",
    lastContactedAt: null,
    lastRepliedAt: null,
    connectedOn: row.connectedOn,
    notes: "",
    isDemo: source.type === "demo",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build an idempotent import plan. Existing contacts are never overwritten:
 * only empty fields are filled from the new file, and the original imported data is preserved.
 */
export function buildImportPlan(
  rows: NormalizedRow[],
  existing: Contact[],
  ownerId: string,
  keywords: Keyword[],
  source: ContactSource,
  now: string,
): ImportPlan {
  const importable = rows.filter(isRowImportable);
  const invalid = rows.filter((r) => !isRowImportable(r));
  const { newRows, existing: matches, duplicatesInFile } = dedupeRows(importable, existing);

  const toCreate = newRows.map((r) => applyClassification(blankContact(ownerId, r, source, now), keywords));

  const toUpdate: Contact[] = [];
  let unchanged = 0;
  for (const { row, contact } of matches) {
    const incoming: Record<(typeof FILL_FIELDS)[number], string> = {
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      company: row.company,
      location: row.location,
      email: row.email,
      linkedInProfileUrl: row.profileUrl,
      connectedOn: row.connectedOn,
    };
    let changed = false;
    const next: Contact = { ...contact };
    for (const f of FILL_FIELDS) {
      if (!next[f] && incoming[f]) {
        (next as unknown as Record<string, string>)[f] = incoming[f];
        changed = true;
      }
    }
    if (!next.originalData) {
      next.originalData = row.original;
      changed = true;
    }
    if (changed) {
      next.updatedAt = now;
      toUpdate.push(applyClassification(next, keywords));
    } else unchanged++;
  }
  return { toCreate, toUpdate, unchanged, duplicatesInFile: duplicatesInFile.length, invalid };
}
