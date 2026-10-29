import type { ClassificationStatus, Contact } from "./types";
import { hasBeenContacted } from "./status";

export type RelevanceFilter = "all" | "relevant" | "unreviewed" | "not_relevant";
export type ProfileFilter = "all" | "with_url" | "without_url";
export type ContactedFilter = "all" | "contacted" | "not_contacted";

export interface ContactFilters {
  search: string;
  jobTitle: string;
  company: string;
  location: string;
  classification: ClassificationStatus | "all";
  relevance: RelevanceFilter;
  profile: ProfileFilter;
  contacted: ContactedFilter;
}

export const EMPTY_FILTERS: ContactFilters = {
  search: "",
  jobTitle: "",
  company: "",
  location: "",
  classification: "all",
  relevance: "all",
  profile: "all",
  contacted: "all",
};

const has = (hay: string, needle: string) => !needle.trim() || hay.toLowerCase().includes(needle.trim().toLowerCase());

export function filterContacts(contacts: Contact[], f: ContactFilters): Contact[] {
  return contacts.filter((c) => {
    if (f.search && !(has(c.fullName, f.search) || has(c.company, f.search) || has(c.jobTitle, f.search) || has(c.email, f.search))) return false;
    if (!has(c.jobTitle, f.jobTitle)) return false;
    if (!has(c.company, f.company)) return false;
    if (!has(c.location, f.location)) return false;
    if (f.classification !== "all" && c.classificationStatus !== f.classification) return false;
    if (f.relevance === "relevant" && !(c.classificationStatus === "potential" || c.classificationStatus === "confirmed")) return false;
    if (f.relevance === "unreviewed" && c.reviewStatus !== "unreviewed") return false;
    if (f.relevance === "not_relevant" && c.classificationStatus !== "not_relevant") return false;
    if (f.profile === "with_url" && !c.linkedInProfileUrl) return false;
    if (f.profile === "without_url" && c.linkedInProfileUrl) return false;
    if (f.contacted === "contacted" && !hasBeenContacted(c)) return false;
    if (f.contacted === "not_contacted" && hasBeenContacted(c)) return false;
    return true;
  });
}

export type SortKey = "fullName" | "firstName" | "jobTitle" | "company" | "classificationStatus" | "lastContactedAt";

export function sortContacts(contacts: Contact[], key: SortKey, dir: "asc" | "desc"): Contact[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...contacts].sort((a, b) => {
    const av = (a[key] ?? "") as string;
    const bv = (b[key] ?? "") as string;
    // empty values always last
    if (!av && bv) return 1;
    if (av && !bv) return -1;
    return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true }) * mul;
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((p - 1) * pageSize, p * pageSize), totalPages, page: p };
}
