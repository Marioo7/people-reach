import type { ClassificationStatus, Contact, Keyword } from "./types";

export const DEFAULT_KEYWORDS: string[] = [
  "HR",
  "Human Resources",
  "HR Manager",
  "HR Specialist",
  "HR Business Partner",
  "Recruiter",
  "Technical Recruiter",
  "IT Recruiter",
  "Talent Acquisition",
  "Talent Acquisition Specialist",
  "Talent Acquisition Partner",
  "Recruitment",
  "Recruitment Specialist",
  "Recruitment Manager",
  "Talent Partner",
  "People & Culture",
  "People Operations",
  "Recruitment Consultant",
];

/** Words that suggest a technical/software role rather than an HR role. A hit lowers confidence. */
const TECH_ROLE_WORDS = ["developer", "engineer", "programmer", "architect", "devops", "qa", "tester", "designer", "analyst intern"];

export interface Classification {
  status: ClassificationStatus;
  matchedKeywords: string[];
  /** Machine-readable reason code + human readable English text (UI translates the code). */
  reasonCode: "keyword_match" | "keyword_match_tech_role" | "no_title" | "no_match";
  reason: string;
}

export function normalizeTitle(title: string): string {
  return ` ${title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

function termTokens(term: string): string {
  return normalizeTitle(term).trim();
}

/**
 * Case-insensitive, word-boundary aware match. Short terms (<= 3 chars, e.g. "HR") must match a whole word
 * so "Chrome" or "Shrink" never match. Longer terms may be followed by a suffix ("recruiter" → "recruiters").
 */
export function titleMatchesTerm(title: string, term: string): boolean {
  const t = termTokens(term);
  if (!t) return false;
  const hay = normalizeTitle(title);
  const needle = ` ${t}`;
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) return false;
    const end = idx + needle.length;
    const rest = hay.slice(end).split(" ")[0] ?? "";
    if (rest === "") return true; // the term ends exactly at a word boundary
    if (t.length >= 5 && rest.length <= 6) return true; // inflection / suffix, e.g. "recruiters", "recruit" → "recruitment"
    from = idx + 1;
  }
}

export function classifyTitle(jobTitle: string, keywords: Keyword[]): Classification {
  const title = jobTitle.trim();
  if (!title) {
    return {
      status: "needs_review",
      matchedKeywords: [],
      reasonCode: "no_title",
      reason: "No job title available, so relevance cannot be determined.",
    };
  }
  const enabled = keywords.filter((k) => k.enabled && k.term.trim());
  const matched = enabled.filter((k) => titleMatchesTerm(title, k.term)).map((k) => k.term);
  if (!matched.length) {
    return { status: "not_relevant", matchedKeywords: [], reasonCode: "no_match", reason: "No configured keyword matches the job title." };
  }
  const normalized = normalizeTitle(title);
  const techHit = TECH_ROLE_WORDS.find((w) => normalized.includes(` ${w} `));
  const hasStrongRecruitTerm = matched.some((m) => /recruit|talent/i.test(m));
  if (techHit && !hasStrongRecruitTerm) {
    return {
      status: "needs_review",
      matchedKeywords: matched,
      reasonCode: "keyword_match_tech_role",
      reason: `Matched "${matched.join('", "')}" but the title also contains "${techHit}", so it may be a technical role. Please review.`,
    };
  }
  return {
    status: "potential",
    matchedKeywords: matched,
    reasonCode: "keyword_match",
    reason: `Job title matches keyword "${matched.join('", "')}". Not verified by LinkedIn — please review.`,
  };
}

/**
 * Apply classification to a contact without overriding the user's own decisions:
 * reviewed contacts keep their status. "confirmed" is never assigned automatically.
 */
export function applyClassification(contact: Contact, keywords: Keyword[]): Contact {
  if (contact.reviewStatus === "reviewed") return contact;
  const c = classifyTitle(contact.jobTitle, keywords);
  return {
    ...contact,
    classificationStatus: c.status,
    matchedKeywords: c.matchedKeywords,
    matchReason: c.reason,
  };
}
