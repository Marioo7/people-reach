import { describe, expect, it } from "vitest";
import { AuthorizationError, assertOwner, filterOwned } from "@/lib/authz";
import { EMPTY_FILTERS, filterContacts, paginate, sortContacts } from "@/lib/filters";
import { TransitionError, canTransition, contactAfterMessage, markMessageSent, recordReply, reopenMessage, skipMessage } from "@/lib/status";
import type { Contact, OutreachMessage } from "@/lib/types";

const T = "2025-01-01T00:00:00.000Z";
const contact = (o: Partial<Contact> = {}): Contact => ({
  id: "c1", ownerId: "u1", firstName: "Sara", lastName: "Ahmed", fullName: "Sara Ahmed", jobTitle: "Recruiter", company: "Acme", location: "Cairo, Egypt",
  linkedInProfileUrl: "https://www.linkedin.com/in/sara", email: "", source: { type: "linkedin_csv", importedAt: T }, originalData: null, matchedKeywords: ["Recruiter"],
  matchReason: "", classificationStatus: "potential", reviewStatus: "unreviewed", outreachStatus: "not_contacted", lastContactedAt: null, lastRepliedAt: null,
  connectedOn: "", notes: "", isDemo: false, createdAt: T, updatedAt: T, ...o,
});
const message = (o: Partial<OutreachMessage> = {}): OutreachMessage => ({
  id: "m1", ownerId: "u1", contactId: "c1", campaignId: null, templateId: "t1", renderedMessage: "Dear Sara", status: "draft", sendingMethod: "linkedin_manual",
  cvDocumentId: null, confirmationMethod: null, createdAt: T, updatedAt: T, sentAt: null, responseRecordedAt: null, errorMessage: null, ...o,
});

describe("outreach status transitions & send confirmation", () => {
  it("refuses to mark as sent without explicit confirmation", () => {
    expect(() => markMessageSent(message(), { confirmed: false, now: T })).toThrow(TransitionError);
  });
  it("opening a profile / copying never changes state (no function does it) and a confirmed manual send is recorded as such", () => {
    const sent = markMessageSent(message(), { confirmed: true, now: "2025-02-01T00:00:00.000Z" });
    expect(sent.status).toBe("sent");
    expect(sent.confirmationMethod).toBe("manual_user_confirmation");
  });
  it("only a reliable provider result counts as automatic confirmation", () => {
    expect(() => markMessageSent(message(), { confirmed: false, providerResult: { reliable: false }, now: T })).toThrow();
    expect(markMessageSent(message(), { confirmed: false, providerResult: { reliable: true }, now: T }).confirmationMethod).toBe("provider_reliable");
  });
  it("is idempotent: re-marking keeps the original sentAt", () => {
    const first = markMessageSent(message(), { confirmed: true, now: "2025-02-01T00:00:00.000Z" });
    const again = markMessageSent(first, { confirmed: true, now: "2025-03-01T00:00:00.000Z" });
    expect(again.sentAt).toBe("2025-02-01T00:00:00.000Z");
    expect(again).toBe(first);
  });
  it("validates the transition graph", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "draft")).toBe(false);
    expect(canTransition("replied", "sent")).toBe(false);
    expect(() => skipMessage(markMessageSent(message(), { confirmed: true, now: T }), T)).toThrow(TransitionError);
    expect(reopenMessage(skipMessage(message(), T), T).status).toBe("draft");
  });
  it("records replies only for sent messages", () => {
    expect(() => recordReply(message(), T)).toThrow(TransitionError);
    const replied = recordReply(markMessageSent(message(), { confirmed: true, now: T }), "2025-04-01T00:00:00.000Z");
    expect(replied.status).toBe("replied");
    expect(replied.responseRecordedAt).toBe("2025-04-01T00:00:00.000Z");
  });
  it("updates the contact and never downgrades a contacted contact", () => {
    const sent = markMessageSent(message(), { confirmed: true, now: "2025-02-01T00:00:00.000Z" });
    const c1 = contactAfterMessage(contact(), sent, T);
    expect(c1.outreachStatus).toBe("sent");
    expect(c1.lastContactedAt).toBe("2025-02-01T00:00:00.000Z");
    const c2 = contactAfterMessage(c1, message({ id: "m2" }), T);
    expect(c2.outreachStatus).toBe("sent");
    expect(contactAfterMessage(c1, message({ status: "skipped" }), T).outreachStatus).toBe("sent");
    expect(contactAfterMessage(contact(), message({ status: "skipped" }), T).outreachStatus).toBe("skipped");
  });
});

describe("contact filtering, sorting and pagination", () => {
  const list = [
    contact({ id: "a", fullName: "Ann", jobTitle: "Technical Recruiter", company: "Acme", location: "Cairo" }),
    contact({ id: "b", fullName: "Bob", jobTitle: "Developer", company: "Globex", classificationStatus: "not_relevant", linkedInProfileUrl: "", location: "Berlin" }),
    contact({ id: "c", fullName: "Cid", jobTitle: "", company: "Acme", reviewStatus: "reviewed", outreachStatus: "sent", lastContactedAt: T }),
  ];
  it("filters by text fields", () => {
    expect(filterContacts(list, { ...EMPTY_FILTERS, company: "acme" }).map((c) => c.id)).toEqual(["a", "c"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, jobTitle: "recruit" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, location: "berlin" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, search: "glob" }).map((c) => c.id)).toEqual(["b"]);
  });
  it("filters by relevance, profile URL and contacted state", () => {
    expect(filterContacts(list, { ...EMPTY_FILTERS, relevance: "relevant" }).map((c) => c.id)).toEqual(["a", "c"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, relevance: "unreviewed" }).map((c) => c.id)).toEqual(["a", "b"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, profile: "without_url" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, contacted: "contacted" }).map((c) => c.id)).toEqual(["c"]);
    expect(filterContacts(list, { ...EMPTY_FILTERS, contacted: "not_contacted" }).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("sorts with empty values last and paginates safely", () => {
    expect(sortContacts(list, "jobTitle", "asc").map((c) => c.id)).toEqual(["b", "a", "c"]);
    expect(sortContacts(list, "jobTitle", "desc").map((c) => c.id)).toEqual(["a", "b", "c"]);
    const p = paginate([1, 2, 3, 4, 5], 99, 2);
    expect(p).toEqual({ items: [5], totalPages: 3, page: 3 });
    expect(paginate([], 1, 10).totalPages).toBe(1);
  });
});

describe("authorization & ownership", () => {
  it("allows the owner and rejects everyone else", () => {
    expect(assertOwner(contact(), "u1").id).toBe("c1");
    expect(() => assertOwner(contact(), "u2")).toThrow(AuthorizationError);
    expect(() => assertOwner(contact(), null)).toThrow(AuthorizationError);
    expect(() => assertOwner(null, "u1")).toThrow(AuthorizationError);
  });
  it("filters collections to the signed-in owner", () => {
    const docs = [contact({ id: "1", ownerId: "u1" }), contact({ id: "2", ownerId: "u2" })];
    expect(filterOwned(docs, "u1").map((d) => d.id)).toEqual(["1"]);
    expect(filterOwned(docs, undefined)).toEqual([]);
  });
});
