import { describe, expect, it } from "vitest";
import { extractFirstName } from "@/lib/names";
import { claimsAttachment, DEFAULT_TEMPLATE_BODY, hasUnresolvedPlaceholders, removeAttachmentSentence, renderTemplate, replaceTargetRole } from "@/lib/templates";
import { CV_CHUNK_CHARS, MAX_CV_BYTES, base64ToBytes, bytesToBase64, hasPdfSignature, sanitizeFileName, splitChunks, validateCvMeta } from "@/lib/cv";

const SENDER = { senderName: "Mario Fathy Bekhit", senderLinkedIn: "https://www.linkedin.com/in/mario", portfolio: "https://marioo-portfolio.vercel.app/" };

describe("first-name extraction", () => {
  it.each([
    ["Sara", "Sara Ahmed", "Sara"],
    ["", "Dr. Omar Hassan", "Omar"],
    ["محمد", "", "محمد"],
    ["Mary Ann", "", "Mary"],
    ["José", "", "José"],
  ])("%s / %s → %s", (first, full, expected) => {
    expect(extractFirstName(first, full)).toBe(expected);
  });

  it.each([[""], ["J."], ["123"], ["😀"], ["-"]])("returns null for unusable name %j", (v) => {
    expect(extractFirstName(v, "")).toBeNull();
  });

  it("returns null when nothing is available", () => {
    expect(extractFirstName(undefined, undefined)).toBeNull();
  });
});

describe("template rendering", () => {
  it("renders the exact default template with the first name", () => {
    const r = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: "Sara", company: "Acme", ...SENDER });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Frontend Developer openings at Acme. I would love to be part of your team there.");
    expect(r.text.startsWith("Dear Sara,\n\nI hope you're doing well!")).toBe(true);
    expect(r.text).toContain("https://marioo-portfolio.vercel.app/");
    expect(r.text.endsWith("Best regards,\nMario Fathy Bekhit\nhttps://www.linkedin.com/in/mario")).toBe(true);
    expect(hasUnresolvedPlaceholders(r.text)).toBe(false);
  });

  it("never produces an empty or wrong greeting when the name is missing", () => {
    const r = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: null });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("missing_first_name");
    expect(r.text).toContain("{{FirstName}}");
    expect(r.text).not.toMatch(/Dear ,/);
    expect(hasUnresolvedPlaceholders(r.text)).toBe(true);
  });

  it("blocks the message when the company is missing instead of writing a wrong company", () => {
    const r = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: "Sara", company: "", ...SENDER });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("missing_company");
    expect(r.text).toContain("{{Company}}");
    expect(r.text).toContain("Dear Sara,");
  });

  it("uses each user's own name, LinkedIn link and portfolio, and blocks when they are missing", () => {
    const other = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: "Sara", company: "Acme", senderName: "Nour Ali", senderLinkedIn: "https://www.linkedin.com/in/nour", portfolio: "https://nour.dev" });
    expect(other.ok).toBe(true);
    expect(other.text).toContain("Best regards,\nNour Ali\nhttps://www.linkedin.com/in/nour");
    expect(other.text).toContain("here:\nhttps://nour.dev");
    expect(other.text).not.toContain("Mario");
    const none = renderTemplate(DEFAULT_TEMPLATE_BODY, { firstName: "Sara", company: "Acme" });
    expect(none.errors).toEqual(expect.arrayContaining(["missing_sender_name", "missing_sender_linkedin", "missing_portfolio"]));
    expect(none.text).toContain("{{SenderName}}");
  });

  it("flags unknown placeholders", () => {
    const r = renderTemplate("Hi {{FirstName}} {{Foo}}", { firstName: "A" });
    expect(r.ok).toBe(false);
    expect(r.unknownPlaceholders).toEqual(["Foo"]);
  });

  it("supports company placeholder and role replacement", () => {
    expect(renderTemplate("At {{Company}}", { firstName: "A", company: "Acme" }).text).toBe("At Acme");
    expect(replaceTargetRole(DEFAULT_TEMPLATE_BODY, "Frontend Developer", "React Developer")).toContain("React Developer openings");
  });

  it("can create a variant without the attachment sentence and keeps the portfolio link", () => {
    const v = removeAttachmentSentence(DEFAULT_TEMPLATE_BODY);
    expect(claimsAttachment(v)).toBe(false);
    expect(v).toContain("You can check out my portfolio here:\n{{Portfolio}}");
    expect(v).toContain("Dear {{FirstName}},");
    expect(removeAttachmentSentence("Hi.\nMy CV is attached. Thanks.")).toBe("Hi.\nThanks.");
  });

  it("detects messages that claim an attachment", () => {
    expect(claimsAttachment(DEFAULT_TEMPLATE_BODY)).toBe(true);
    expect(claimsAttachment("Hello, hope you are well.")).toBe(false);
  });
});

describe("CV validation", () => {
  const ok = { name: "cv.pdf", type: "application/pdf", size: 1024 };
  it("accepts a valid PDF", () => expect(validateCvMeta(ok)).toEqual([]));
  it("rejects wrong type, empty and oversized files", () => {
    expect(validateCvMeta({ ...ok, type: "image/png", name: "cv.png" })).toContain("not_pdf");
    expect(validateCvMeta({ ...ok, size: 0 })).toContain("empty");
    expect(validateCvMeta({ ...ok, size: MAX_CV_BYTES + 1 })).toContain("too_large");
    expect(validateCvMeta({ ...ok, name: "../evil.pdf" })).toContain("bad_name");
  });
  it("checks the PDF magic bytes", () => {
    expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(hasPdfSignature(new TextEncoder().encode("MZ binary"))).toBe(false);
  });
  it("sanitises file names", () => {
    expect(sanitizeFileName("../../my cv<>.pdf")).toBe("my cv_.pdf");
    expect(sanitizeFileName("resume")).toBe("resume.pdf");
  });
  it("round-trips a CV through base64 chunks (the way it is stored in Firestore)", () => {
    const original = new Uint8Array(1_400_000).map((_, i) => (i * 31 + 7) % 256);
    original.set(new TextEncoder().encode("%PDF-1.7"), 0);
    const chunks = splitChunks(bytesToBase64(original));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= CV_CHUNK_CHARS)).toBe(true);
    const back = base64ToBytes(chunks.join(""));
    expect(back.length).toBe(original.length);
    expect(back.every((b, i) => b === original[i])).toBe(true);
    expect(hasPdfSignature(back)).toBe(true);
  });
  it("keeps a maximum-size CV within the 10 chunk limit enforced by the rules", () => {
    const b64Len = Math.ceil(MAX_CV_BYTES / 3) * 4;
    expect(Math.ceil(b64Len / CV_CHUNK_CHARS)).toBeLessThanOrEqual(10);
    expect(CV_CHUNK_CHARS).toBeLessThan(1_000_000);
  });
});
