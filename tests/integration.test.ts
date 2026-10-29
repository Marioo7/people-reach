import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_KEYWORDS } from "@/lib/classify";
import { buildImportPlan } from "@/lib/csv/import-plan";
import { normalizeRows, parseCsvText } from "@/lib/csv/parse";
import { localStore } from "@/lib/data/local-store";
import { extractFirstName } from "@/lib/names";
import { hasBlockingError, validateMessage } from "@/lib/review";
import { contactAfterMessage, markMessageSent } from "@/lib/status";
import { DEFAULT_TEMPLATE_BODY, renderTemplate } from "@/lib/templates";
import type { Contact, CvDocument, OutreachMessage } from "@/lib/types";

// Minimal browser storage stub so the demo-mode store can run under Node.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
beforeEach(() => { (globalThis as unknown as { window: unknown }).window = { localStorage: new MemoryStorage() }; });

const CSV = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Sara,Ahmed,https://www.linkedin.com/in/sara-ahmed,,Acme,Technical Recruiter,01 Jan 2024
Omar,Hassan,https://www.linkedin.com/in/omar-hassan,,Globex,Frontend Developer,02 Jan 2024
,Smith,https://www.linkedin.com/in/smith,,Initech,HR Manager,03 Jan 2024
`;
const SENDER = { senderName: "Mario Fathy Bekhit", senderLinkedIn: "https://www.linkedin.com/in/mario", portfolio: "https://marioo-portfolio.vercel.app/" };
const senderProfile = { name: "Mario Fathy Bekhit", linkedIn: "https://www.linkedin.com/in/mario", portfolio: "https://marioo-portfolio.vercel.app/" };
const kws = DEFAULT_KEYWORDS.map((term, i) => ({ id: `k${i}`, term, enabled: true }));
const NOW = "2025-01-01T00:00:00.000Z";
const cv: CvDocument = { id: "cv1", ownerId: "u1", fileName: "mario-cv.pdf", sizeBytes: 100, chunkCount: 1, createdAt: NOW, updatedAt: NOW };

describe("end-to-end workflow (import → classify → prepare → review → confirm)", () => {
  it("runs the whole pipeline through the local store with ownership isolation", async () => {
    const parsed = parseCsvText(CSV);
    const plan = buildImportPlan(normalizeRows(parsed.rows, parsed.suggestedMapping), [], "u1", kws, { type: "linkedin_csv", fileName: "c.csv", importedAt: NOW }, NOW);
    await localStore.putMany("contacts", plan.toCreate);

    // another user never sees these contacts
    expect(await localStore.list("contacts", "u2")).toHaveLength(0);
    const stored = await localStore.list<Contact>("contacts", "u1");
    expect(stored).toHaveLength(3);

    const sara = stored.find((c) => c.fullName === "Sara Ahmed")!;
    const omar = stored.find((c) => c.fullName === "Omar Hassan")!;
    expect(sara.classificationStatus).toBe("potential");
    expect(sara.matchedKeywords).toContain("Technical Recruiter");
    expect(omar.classificationStatus).toBe("not_relevant");

    // contact without a first name is flagged, never greeted with an empty name
    const smith = stored.find((c) => c.lastName === "Smith")!;
    expect(extractFirstName(smith.firstName, smith.fullName)).toBe("Smith"); // falls back to full name token only if valid
    const noName = { ...smith, firstName: "", fullName: "" };
    const rendered = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: extractFirstName(noName.firstName, noName.fullName), company: "Initech", ...SENDER });
    expect(rendered.ok).toBe(false);

    // prepare + validate + confirm
    const text = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: extractFirstName(sara.firstName, sara.fullName), company: sara.company, ...SENDER }).text;
    expect(text).toContain("openings at Acme");
    const draft: OutreachMessage = { id: "m1", ownerId: "u1", contactId: sara.id, campaignId: null, templateId: "t", renderedMessage: text, status: "draft", sendingMethod: "linkedin_manual", cvDocumentId: null, confirmationMethod: null, createdAt: NOW, updatedAt: NOW, sentAt: null, responseRecordedAt: null, errorMessage: null };

    // text with an unresolved company placeholder is blocked
    const noCompany = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: "Sara", company: "", ...SENDER }).text;
    expect(validateMessage({ text: noCompany, contact: { ...sara, company: "" }, cv, method: "linkedin_manual", firstNameOk: true, sender: senderProfile }).map((x) => x.code)).toContain("missing_company");

    // claims an attachment but no CV selected → blocking error
    expect(hasBlockingError(validateMessage({ text, contact: sara, cv: null, method: "linkedin_manual", firstNameOk: true, sender: senderProfile }))).toBe(true);
    // with a CV selected it is allowed, but the manual attach step is flagged
    const w = validateMessage({ text, contact: sara, cv, method: "linkedin_manual", firstNameOk: true, sender: senderProfile });
    expect(hasBlockingError(w)).toBe(false);
    expect(w.map((x) => x.code)).toContain("attachment_manual_step");

    expect(() => markMessageSent(draft, { confirmed: false, now: NOW })).toThrow();
    const sent = markMessageSent(draft, { confirmed: true, now: "2025-02-01T00:00:00.000Z" });
    await localStore.put("outreachMessages", sent);
    await localStore.put("contacts", contactAfterMessage(sara, sent, NOW));

    const after = (await localStore.list<Contact>("contacts", "u1")).find((c) => c.id === sara.id)!;
    expect(after.outreachStatus).toBe("sent");
    expect(after.lastContactedAt).toBe("2025-02-01T00:00:00.000Z");

    // already-contacted warning for a follow-up draft
    const warn = validateMessage({ text, contact: after, cv, method: "linkedin_manual", firstNameOk: true, sender: senderProfile });
    // a user who has not filled in their own profile is blocked from sending
    const unfilled = validateMessage({ text: renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: "Sara", company: "Acme" }).text, contact: sara, cv, method: "linkedin_manual", firstNameOk: true, sender: { name: "", linkedIn: "", portfolio: "" } });
    expect(unfilled.map((x) => x.code)).toEqual(expect.arrayContaining(["missing_sender_name", "missing_sender_linkedin", "missing_portfolio"]));
    expect(warn.map((x) => x.code)).toContain("already_contacted");
  });
});
