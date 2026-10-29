import { applyClassification } from "../classify";
import { buildFullName } from "../names";
import type { Contact, Keyword } from "../types";
import { stableHash } from "../utils";

/** Fictional people only. Every record is flagged isDemo and source.type === "demo". */
const DEMO: [string, string, string, string, string][] = [
  ["Layla", "Demo-Hart", "Technical Recruiter", "Northwind Demo Co", "Cairo, Egypt"],
  ["Karim", "Demo-Nasser", "Senior Talent Acquisition Partner", "Contoso Demo Ltd", "Dubai, UAE"],
  ["Nora", "Demo-Lund", "HR Business Partner", "Fabrikam Demo", "Berlin, Germany"],
  ["Youssef", "Demo-Adel", "People & Culture Manager", "Tailspin Demo", "Alexandria, Egypt"],
  ["Mia", "Demo-Stone", "Recruitment Consultant", "Adventure Demo Works", "London, UK"],
  ["Tarek", "Demo-Samir", "Frontend Developer", "Wingtip Demo", "Cairo, Egypt"],
  ["Dana", "Demo-Reed", "Frontend Developer – HR Platform", "Humongous Demo", "Remote"],
  ["Hany", "Demo-Fouad", "", "Litware Demo", "Giza, Egypt"],
  ["Rania", "Demo-Salem", "Product Designer", "Proseware Demo", "Cairo, Egypt"],
  ["Omar", "Demo-Khalil", "IT Recruiter", "Margie Demo Travel", "Riyadh, KSA"],
];

export function buildDemoContacts(ownerId: string, keywords: Keyword[], now: string): Contact[] {
  return DEMO.map(([first, last, title, company, location]) => {
    const fullName = buildFullName(first, last);
    const base: Contact = {
      id: `ct_demo_${stableHash(`${ownerId}|${fullName}`)}`,
      ownerId,
      firstName: first,
      lastName: last,
      fullName,
      jobTitle: title,
      company,
      location,
      linkedInProfileUrl: `https://www.linkedin.com/in/demo-${first.toLowerCase()}-${last.toLowerCase().replace("demo-", "")}`,
      email: "",
      source: { type: "demo", importedAt: now },
      originalData: null,
      matchedKeywords: [],
      matchReason: "",
      classificationStatus: "needs_review",
      reviewStatus: "unreviewed",
      outreachStatus: "not_contacted",
      lastContactedAt: null,
      lastRepliedAt: null,
      connectedOn: "",
      notes: "",
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    };
    return applyClassification(base, keywords);
  });
}
