import { describe, expect, it } from "vitest";
import { applyClassification, classifyTitle, DEFAULT_KEYWORDS, titleMatchesTerm } from "@/lib/classify";
import type { Contact, Keyword } from "@/lib/types";

const kw: Keyword[] = DEFAULT_KEYWORDS.map((term, i) => ({ id: `k${i}`, term, enabled: true }));

describe("job-title classification", () => {
  it.each([
    ["Technical Recruiter", true],
    ["Senior TALENT ACQUISITION Partner", true],
    ["hr manager", true],
    ["Recruiters Team Lead", true],
    ["Head of People & Culture", true],
    ["People and Culture Partner", true],
    ["Human Resources Business Partner", true],
    ["Frontend Developer", false],
    ["Chrome Extension Specialist", false],
    ["Shrink Wrap Operator", false],
    ["HRIS Analyst", false],
  ])("%s → matched=%s", (title, expected) => {
    expect(classifyTitle(title, kw).matchedKeywords.length > 0).toBe(expected);
  });

  it("matches case-insensitively and by partial phrase", () => {
    expect(titleMatchesTerm("Senior IT RECRUITER at X", "recruiter")).toBe(true);
    expect(titleMatchesTerm("Recruitment", "Recruit")).toBe(true);
  });

  it("never claims 'confirmed' automatically", () => {
    expect(classifyTitle("Talent Acquisition Specialist", kw).status).toBe("potential");
  });

  it("asks for review when the title is missing", () => {
    const r = classifyTitle("", kw);
    expect(r.status).toBe("needs_review");
    expect(r.reasonCode).toBe("no_title");
  });

  it("downgrades technical roles that merely mention HR", () => {
    const r = classifyTitle("Frontend Developer – HR Platform", kw);
    expect(r.status).toBe("needs_review");
    expect(r.reasonCode).toBe("keyword_match_tech_role");
  });

  it("explains the match and honours disabled / custom keywords", () => {
    const custom: Keyword[] = [{ id: "a", term: "Sourcer", enabled: true }, { id: "b", term: "Recruiter", enabled: false }];
    expect(classifyTitle("Recruiter", custom).status).toBe("not_relevant");
    const r = classifyTitle("Talent Sourcer", custom);
    expect(r.matchedKeywords).toEqual(["Sourcer"]);
    expect(r.reason).toContain("Sourcer");
  });

  it("does not override reviewed contacts", () => {
    const contact = { jobTitle: "Recruiter", reviewStatus: "reviewed", classificationStatus: "not_relevant", matchedKeywords: [], matchReason: "" } as unknown as Contact;
    expect(applyClassification(contact, kw).classificationStatus).toBe("not_relevant");
  });
});
