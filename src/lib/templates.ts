export const DEFAULT_TEMPLATE_NAME = "Default – Frontend Developer outreach";

/**
 * The sender's name, LinkedIn link and portfolio come from each user's own profile (Settings → Your profile),
 * so every person who signs in sends messages in their own name. Edit the wording in Message Templates.
 */
export const DEFAULT_TEMPLATE_BODY = `Dear {{FirstName}},

I hope you're doing well!

I'm a Frontend Developer with 3 years of experience, specializing in Angular and React. I'm currently exploring new opportunities and would really appreciate it if you could recommend me for any suitable Frontend Developer openings at {{Company}}. I would love to be part of your team there.

I've attached my CV for your reference. You can also check out my portfolio here:
{{Portfolio}}

Thank you for your time and support!

Best regards,
{{SenderName}}
{{SenderLinkedIn}}`;

export const KNOWN_PLACEHOLDERS = ["FirstName", "LastName", "FullName", "Company", "JobTitle", "SenderName", "SenderLinkedIn", "Portfolio"] as const;
type Placeholder = (typeof KNOWN_PLACEHOLDERS)[number];

export type RenderError = "missing_first_name" | "missing_company" | "missing_sender_name" | "missing_sender_linkedin" | "missing_portfolio" | "unknown_placeholder";

export interface RenderContext {
  firstName: string | null;
  lastName?: string;
  fullName?: string;
  company?: string;
  jobTitle?: string;
  /** From the signed-in user's profile. */
  senderName?: string;
  senderLinkedIn?: string;
  portfolio?: string;
}

export interface RenderResult {
  text: string;
  ok: boolean;
  /** Blocking problems (e.g. missing first name). */
  errors: RenderError[];
  unknownPlaceholders: string[];
}

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

const MISSING_ERROR: Partial<Record<Placeholder, RenderError>> = {
  FirstName: "missing_first_name",
  Company: "missing_company",
  SenderName: "missing_sender_name",
  SenderLinkedIn: "missing_sender_linkedin",
  Portfolio: "missing_portfolio",
};

export function findPlaceholders(body: string): string[] {
  return [...body.matchAll(PLACEHOLDER_RE)].map((m) => m[1] ?? "");
}

/**
 * Render a template. A placeholder with no value is left visible and reported as an error, so a message is
 * never produced with an empty or wrong name, company or link.
 */
export function renderTemplate(body: string, ctx: RenderContext): RenderResult {
  const errors: RenderError[] = [];
  const unknown: string[] = [];
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const values: Record<Placeholder, string | null> = {
    FirstName: clean(ctx.firstName),
    LastName: clean(ctx.lastName),
    FullName: clean(ctx.fullName),
    Company: clean(ctx.company),
    JobTitle: clean(ctx.jobTitle),
    SenderName: clean(ctx.senderName),
    SenderLinkedIn: clean(ctx.senderLinkedIn),
    Portfolio: clean(ctx.portfolio),
  };
  const text = body.replace(PLACEHOLDER_RE, (match, name: string) => {
    if (!(name in values)) {
      unknown.push(name);
      return match;
    }
    const v = values[name as Placeholder];
    if (v === null) {
      const err = MISSING_ERROR[name as Placeholder];
      if (err && !errors.includes(err)) errors.push(err);
      return match;
    }
    return v;
  });
  if (unknown.length) errors.push("unknown_placeholder");
  return { text, ok: errors.length === 0, errors, unknownPlaceholders: unknown };
}

/** Does the message text state that a CV/resume is attached? */
export function claimsAttachment(text: string): boolean {
  return /\b(attached|attachment|attachments|enclosed)\b/i.test(text);
}

export function hasUnresolvedPlaceholders(text: string): boolean {
  return /\{\{[^}]*\}\}/.test(text);
}

/** Replace the target role wording (e.g. "Frontend Developer" → "React Developer") across a template body. */
export function replaceTargetRole(body: string, from: string, to: string): string {
  const f = from.trim();
  const t = to.trim();
  if (!f || !t) return body;
  return body.split(f).join(t);
}

/** Variant for people who prefer not to attach a file: drops the "attached my CV" sentence and keeps the portfolio link. */
export function removeAttachmentSentence(body: string): string {
  const direct = body.replace(/I['’]ve attached my CV for your reference\.\s*You can also check out my portfolio here:/i, "You can check out my portfolio here:");
  if (direct !== body) return direct;
  return body.replace(/[^.\n]*\b(attached|attachment|enclosed)\b[^.\n]*\.\s*/gi, "");
}
