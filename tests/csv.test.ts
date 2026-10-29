import { describe, expect, it } from "vitest";
import { detectMapping } from "@/lib/csv/columns";
import { isRowImportable, normalizeLinkedInUrl, normalizeRows, parseCsvText, sanitizeCell } from "@/lib/csv/parse";
import { buildImportPlan } from "@/lib/csv/import-plan";
import { contactIdFor, dedupeRows } from "@/lib/csv/dedupe";
import { DEFAULT_KEYWORDS } from "@/lib/classify";
import type { Contact, ContactSource, Keyword } from "@/lib/types";

const LINKEDIN_EXPORT = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Sara,Ahmed,https://www.linkedin.com/in/sara-ahmed/,sara@acme.com,Acme,Technical Recruiter,12 Mar 2024
Omar,Hassan,https://eg.linkedin.com/in/omar-hassan?trk=abc,,Globex,Senior Frontend Developer,01 Jan 2023
Sara,Ahmed,linkedin.com/in/SARA-AHMED,,Acme,Technical Recruiter,12 Mar 2024
,,,,Initech,HR Manager,
`;

const keywords: Keyword[] = DEFAULT_KEYWORDS.map((term, i) => ({ id: `k${i}`, term, enabled: true }));
const source: ContactSource = { type: "linkedin_csv", fileName: "Connections.csv", importedAt: "2025-01-01T00:00:00.000Z" };

describe("CSV parsing", () => {
  it("skips the LinkedIn 'Notes' preamble and finds the header", () => {
    const parsed = parseCsvText(LINKEDIN_EXPORT);
    expect(parsed.headers).toEqual(["First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On"]);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.errors).toEqual([]);
  });

  it("handles BOM, quotes and empty files", () => {
    const parsed = parseCsvText('\uFEFFFirst Name,Last Name\n"Ann, Marie",Lee');
    expect(parsed.rows[0]?.["First Name"]).toBe("Ann, Marie");
    expect(parseCsvText("   ").errors).toContain("empty_file");
  });

  it("reports an unrecognised header so the user can map columns manually", () => {
    const parsed = parseCsvText("colA,colB,colC\nx,y,z");
    expect(parsed.errors).toContain("header_not_recognized");
    expect(parsed.suggestedMapping).toEqual({});
  });

  it("rejects oversized input", () => {
    const parsed = parseCsvText("a".repeat(11 * 1024 * 1024));
    expect(parsed.errors).toContain("file_too_large");
  });

  it("sanitises control characters and caps length", () => {
    expect(sanitizeCell("Ann\u0007  Lee")).toBe("Ann Lee");
    expect(sanitizeCell("x".repeat(1000))).toHaveLength(500);
  });
});

describe("column mapping", () => {
  it("auto-detects different column names", () => {
    const m = detectMapping(["Given Name", "Surname", "Profile URL", "Mail", "Organization", "Job Title", "Country"]);
    expect(m).toMatchObject({ firstName: "Given Name", lastName: "Surname", profileUrl: "Profile URL", email: "Mail", company: "Organization", jobTitle: "Job Title", location: "Country" });
  });

  it("normalizes rows with a manual mapping and flags problems", () => {
    const rows = normalizeRows(
      [
        { A: "Mona Said", B: "not-a-url", C: "bad-email", D: "HR Manager" },
        { A: "", B: "", C: "", D: "" },
      ],
      { fullName: "A", profileUrl: "B", email: "C", jobTitle: "D" },
    );
    expect(rows[0]?.firstName).toBe("Mona");
    expect(rows[0]?.lastName).toBe("Said");
    expect(rows[0]?.issues).toEqual(expect.arrayContaining(["invalid_profile_url", "invalid_email"]));
    expect(rows[1]?.issues).toEqual(expect.arrayContaining(["empty_row", "missing_name"]));
  });

  it("normalizes LinkedIn URLs", () => {
    expect(normalizeLinkedInUrl("https://eg.linkedin.com/in/Omar-Hassan/?trk=1")).toBe("https://www.linkedin.com/in/omar-hassan");
    expect(normalizeLinkedInUrl("linkedin.com/in/a-b")).toBe("https://www.linkedin.com/in/a-b");
    expect(normalizeLinkedInUrl("https://evil.com/in/x")).toBe("");
    expect(normalizeLinkedInUrl("https://www.linkedin.com/company/acme")).toBe("");
  });
});

describe("duplicate detection & idempotent import", () => {
  const parsed = parseCsvText(LINKEDIN_EXPORT);
  const rows = normalizeRows(parsed.rows, parsed.suggestedMapping);

  it("drops in-file duplicates (same profile URL in different formats)", () => {
    const { newRows, duplicatesInFile } = dedupeRows(rows.filter(isRowImportable), []);
    expect(newRows).toHaveLength(2);
    expect(duplicatesInFile).toHaveLength(1);
  });

  it("falls back to name+company when no URL or email is present", () => {
    const a = normalizeRows([{ n: "Lina Adel", c: "Initech" }], { fullName: "n", company: "c" });
    const b = normalizeRows([{ n: "lina  adel", c: "INITECH" }], { fullName: "n", company: "c" });
    expect(contactIdFor("u1", a[0]!)).toBe(contactIdFor("u1", b[0]!));
    expect(contactIdFor("u1", a[0]!)).not.toBe(contactIdFor("u2", a[0]!));
  });

  it("a second import creates nothing new and never overwrites user edits", () => {
    const first = buildImportPlan(rows, [], "u1", keywords, source, "2025-01-01T00:00:00.000Z");
    expect(first.toCreate).toHaveLength(2);
    expect(first.invalid).toHaveLength(1);
    const edited: Contact[] = first.toCreate.map((c) => (c.fullName === "Sara Ahmed" ? { ...c, jobTitle: "Head of Talent", notes: "met at event" } : c));
    const second = buildImportPlan(rows, edited, "u1", keywords, source, "2025-02-01T00:00:00.000Z");
    expect(second.toCreate).toHaveLength(0);
    expect(second.toUpdate).toHaveLength(0);
    expect(second.unchanged).toBe(2);
    expect(edited.find((c) => c.fullName === "Sara Ahmed")?.jobTitle).toBe("Head of Talent");
  });

  it("fills only empty fields on re-import and preserves original data and source", () => {
    const first = buildImportPlan(rows, [], "u1", keywords, source, "2025-01-01T00:00:00.000Z");
    const stripped = first.toCreate.map((c) => (c.fullName === "Omar Hassan" ? { ...c, company: "" } : c));
    const second = buildImportPlan(rows, stripped, "u1", keywords, { ...source, importedAt: "2025-03-01T00:00:00.000Z" }, "2025-03-01T00:00:00.000Z");
    expect(second.toUpdate).toHaveLength(1);
    expect(second.toUpdate[0]?.company).toBe("Globex");
    expect(second.toUpdate[0]?.source.importedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(second.toUpdate[0]?.originalData).toBeTruthy();
  });
});
