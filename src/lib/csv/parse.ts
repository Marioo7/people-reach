import Papa from "papaparse";
import { buildFullName } from "../names";
import { countRecognizedHeaders, detectMapping, type ColumnMapping, type FieldKey } from "./columns";

export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 50_000;
const MAX_FIELD_LENGTH = 500;

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  headerLineIndex: number;
  suggestedMapping: ColumnMapping;
  /** Fatal or notable problems for the file as a whole. */
  errors: string[];
}

export interface NormalizedRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  company: string;
  jobTitle: string;
  profileUrl: string;
  location: string;
  connectedOn: string;
  original: Record<string, string>;
  issues: string[];
}

/** Remove BOM, control characters and cap length. Does not alter ordinary text. */
export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}

/**
 * LinkedIn's Connections.csv starts with a few "Notes:" lines before the real header.
 * Find the first line that looks like a header row.
 */
function findHeaderLine(lines: string[][]): number {
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i] ?? [];
    if (line.length >= 2 && countRecognizedHeaders(line.map((c) => sanitizeCell(c))) >= 2) return i;
  }
  return -1;
}

export function parseCsvText(text: string): ParsedCsv {
  const errors: string[] = [];
  if (!text || !text.trim()) {
    return { headers: [], rows: [], headerLineIndex: -1, suggestedMapping: {}, errors: ["empty_file"] };
  }
  if (text.length > MAX_CSV_BYTES) {
    return { headers: [], rows: [], headerLineIndex: -1, suggestedMapping: {}, errors: ["file_too_large"] };
  }

  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  const lines = result.data.filter((r) => Array.isArray(r));
  if (result.errors.some((e) => e.type === "Quotes")) errors.push("malformed_quotes");

  let headerIdx = findHeaderLine(lines);
  if (headerIdx === -1) {
    // Fall back to the first row with >= 2 columns so the user can map columns manually.
    headerIdx = lines.findIndex((l) => l.length >= 2);
    if (headerIdx === -1) {
      return { headers: [], rows: [], headerLineIndex: -1, suggestedMapping: {}, errors: [...errors, "no_header"] };
    }
    errors.push("header_not_recognized");
  }

  const headers = (lines[headerIdx] ?? []).map((h, i) => sanitizeCell(h) || `Column ${i + 1}`);
  const dataLines = lines.slice(headerIdx + 1);
  if (dataLines.length > MAX_CSV_ROWS) errors.push("too_many_rows");

  const rows = dataLines.slice(0, MAX_CSV_ROWS).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = sanitizeCell(cells[i]);
    });
    return row;
  });

  return { headers, rows, headerLineIndex: headerIdx, suggestedMapping: detectMapping(headers), errors };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeLinkedInUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  let url = v;
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, "")}`;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^(www|[a-z]{2})\./, "");
    if (host !== "linkedin.com") return "";
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "").toLowerCase();
    if (!/^\/(in|pub)\/[^/]+/.test(path)) return "";
    return `https://www.linkedin.com${path}`;
  } catch {
    return "";
  }
}

export function normalizeRows(rows: Record<string, string>[], mapping: ColumnMapping): NormalizedRow[] {
  const get = (row: Record<string, string>, key: FieldKey) => {
    const col = mapping[key];
    return col ? sanitizeCell(row[col]) : "";
  };
  return rows.map((row, i) => {
    const issues: string[] = [];
    let firstName = get(row, "firstName");
    let lastName = get(row, "lastName");
    let fullName = get(row, "fullName");
    if (!firstName && !lastName && fullName) {
      const parts = fullName.split(" ");
      firstName = parts[0] ?? "";
      lastName = parts.slice(1).join(" ");
    }
    if (!fullName) fullName = buildFullName(firstName, lastName);

    const rawUrl = get(row, "profileUrl");
    const profileUrl = normalizeLinkedInUrl(rawUrl);
    if (rawUrl && !profileUrl) issues.push("invalid_profile_url");

    const email = get(row, "email").toLowerCase();
    if (email && !EMAIL_RE.test(email)) issues.push("invalid_email");

    if (!fullName) issues.push("missing_name");

    const hasAnyData = Object.values(row).some((v) => v);
    if (!hasAnyData) issues.push("empty_row");

    return {
      rowNumber: i + 1,
      firstName,
      lastName,
      fullName,
      email: email && EMAIL_RE.test(email) ? email : "",
      company: get(row, "company"),
      jobTitle: get(row, "jobTitle"),
      profileUrl,
      location: get(row, "location"),
      connectedOn: get(row, "connectedOn"),
      original: row,
      issues,
    };
  });
}

export function isRowImportable(row: NormalizedRow): boolean {
  return !row.issues.includes("empty_row") && !row.issues.includes("missing_name");
}
