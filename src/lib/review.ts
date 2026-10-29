import { hasBeenContacted } from "./status";
import { claimsAttachment, findPlaceholders } from "./templates";
import type { Contact, CvDocument, SendingMethod } from "./types";

export type WarningCode =
  | "empty_message"
  | "missing_first_name"
  | "missing_company"
  | "missing_sender_name"
  | "missing_sender_linkedin"
  | "missing_portfolio"
  | "unresolved_placeholder"
  | "claims_attachment_no_cv"
  | "attachment_manual_step"
  | "no_profile_url"
  | "no_email"
  | "already_contacted"
  | "not_relevant_contact";

export interface ReviewWarning {
  code: WarningCode;
  level: "error" | "warning" | "info";
}

export interface SenderProfile {
  name: string;
  linkedIn: string;
  portfolio: string;
}

/**
 * Pure validation used by Review & Send. Errors block "Mark as sent".
 * Unresolved placeholders still present in the text decide which data is missing; if the data now exists
 * but the text wasn't re-rendered yet, the generic "unresolved placeholder" error asks for a re-render.
 */
export function validateMessage(input: {
  text: string;
  contact: Contact;
  cv: CvDocument | null;
  method: SendingMethod;
  firstNameOk: boolean;
  sender?: SenderProfile;
}): ReviewWarning[] {
  const w: ReviewWarning[] = [];
  const { text, contact, cv, method, sender } = input;
  const unresolved = new Set(findPlaceholders(text));
  const handled = new Set<string>();

  if (!text.trim()) w.push({ code: "empty_message", level: "error" });

  if (!input.firstNameOk) {
    w.push({ code: "missing_first_name", level: "error" });
    handled.add("FirstName");
  }
  const dataChecks: [string, WarningCode, boolean][] = [
    ["Company", "missing_company", !contact.company.trim()],
    ["SenderName", "missing_sender_name", !(sender?.name ?? "").trim()],
    ["SenderLinkedIn", "missing_sender_linkedin", !(sender?.linkedIn ?? "").trim()],
    ["Portfolio", "missing_portfolio", !(sender?.portfolio ?? "").trim()],
  ];
  for (const [placeholder, code, missing] of dataChecks) {
    if (unresolved.has(placeholder) && missing) {
      w.push({ code, level: "error" });
      handled.add(placeholder);
    }
  }
  if ([...unresolved].some((p) => !handled.has(p))) w.push({ code: "unresolved_placeholder", level: "error" });

  const claims = claimsAttachment(text);
  if (claims && !cv) w.push({ code: "claims_attachment_no_cv", level: "error" });
  if (claims && cv) w.push({ code: "attachment_manual_step", level: "info" });
  if (method === "linkedin_manual" && !contact.linkedInProfileUrl) w.push({ code: "no_profile_url", level: "warning" });
  if (method === "email_manual" && !contact.email) w.push({ code: "no_email", level: "error" });
  if (hasBeenContacted(contact)) w.push({ code: "already_contacted", level: "warning" });
  if (contact.classificationStatus === "not_relevant") w.push({ code: "not_relevant_contact", level: "warning" });
  return w;
}

export const hasBlockingError = (w: ReviewWarning[]) => w.some((x) => x.level === "error");
