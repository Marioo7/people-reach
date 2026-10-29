export type FieldKey =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "company"
  | "jobTitle"
  | "profileUrl"
  | "location"
  | "connectedOn";

export const FIELD_KEYS: FieldKey[] = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "company",
  "jobTitle",
  "profileUrl",
  "location",
  "connectedOn",
];

/** Known header spellings (normalised: lowercase, alphanumerics only). */
export const ALIASES: Record<FieldKey, string[]> = {
  firstName: ["firstname", "first", "givenname", "forename"],
  lastName: ["lastname", "last", "surname", "familyname"],
  fullName: ["name", "fullname", "contactname", "displayname"],
  email: ["emailaddress", "email", "mail", "workemail", "emailaddr"],
  company: ["company", "companyname", "organization", "organisation", "employer", "currentcompany"],
  jobTitle: ["position", "jobtitle", "title", "headline", "role", "currentposition", "currenttitle"],
  profileUrl: ["url", "profileurl", "linkedinurl", "linkedinprofile", "linkedinprofileurl", "profilelink", "link"],
  location: ["location", "country", "city", "region", "geo", "locationname"],
  connectedOn: ["connectedon", "connectiondate", "connectedat", "dateconnected"],
};

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export type ColumnMapping = Partial<Record<FieldKey, string>>;

/** Map each field to the first header that matches an alias. Unmatched fields stay undefined. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const key of FIELD_KEYS) {
    for (const alias of ALIASES[key]) {
      const found = headers.find((h) => !used.has(h) && normalizeHeader(h) === alias);
      if (found) {
        mapping[key] = found;
        used.add(found);
        break;
      }
    }
  }
  return mapping;
}

export function countRecognizedHeaders(headers: string[]): number {
  const all = new Set(Object.values(ALIASES).flat());
  return headers.filter((h) => all.has(normalizeHeader(h))).length;
}
