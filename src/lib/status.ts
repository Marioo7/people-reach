import type { ConfirmationMethod, Contact, ContactOutreachStatus, MessageStatus, OutreachMessage } from "./types";

const MESSAGE_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  draft: ["draft", "sent", "skipped"],
  skipped: ["skipped", "draft"],
  sent: ["sent", "replied"],
  replied: ["replied"],
};

export function canTransition(from: MessageStatus, to: MessageStatus): boolean {
  return MESSAGE_TRANSITIONS[from].includes(to);
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export interface ProviderSendResult {
  /** True only when the provider returned an unambiguous, verified success. */
  reliable: boolean;
}

export interface MarkSentInput {
  /** The user explicitly confirmed in the UI. Required for manual sending. */
  confirmed: boolean;
  /** Only honoured when a provider returns a reliable success result. */
  providerResult?: ProviderSendResult;
  now: string;
}

/**
 * Mark a message as sent. Opening a profile or copying text never calls this.
 * Idempotent: an already-sent message is returned unchanged (original sentAt preserved).
 */
export function markMessageSent(message: OutreachMessage, input: MarkSentInput): OutreachMessage {
  if (message.status === "sent" || message.status === "replied") return message;
  if (!canTransition(message.status, "sent")) throw new TransitionError(`Cannot mark a ${message.status} message as sent.`);
  let method: ConfirmationMethod;
  if (input.providerResult?.reliable) method = "provider_reliable";
  else if (input.confirmed) method = "manual_user_confirmation";
  else throw new TransitionError("Explicit confirmation is required before a message can be marked as sent.");
  return { ...message, status: "sent", sentAt: input.now, confirmationMethod: method, updatedAt: input.now, errorMessage: null };
}

export function skipMessage(message: OutreachMessage, now: string): OutreachMessage {
  if (message.status === "skipped") return message;
  if (!canTransition(message.status, "skipped")) throw new TransitionError(`Cannot skip a ${message.status} message.`);
  return { ...message, status: "skipped", updatedAt: now };
}

export function reopenMessage(message: OutreachMessage, now: string): OutreachMessage {
  if (message.status === "draft") return message;
  if (!canTransition(message.status, "draft")) throw new TransitionError(`Cannot reopen a ${message.status} message.`);
  return { ...message, status: "draft", updatedAt: now };
}

export function recordReply(message: OutreachMessage, now: string): OutreachMessage {
  if (message.status === "replied") return message;
  if (message.status !== "sent") throw new TransitionError("A reply can only be recorded for a sent message.");
  return { ...message, status: "replied", responseRecordedAt: now, updatedAt: now };
}

/** Derive the contact-level outreach state after a message change. Never downgrades sent/replied. */
export function contactAfterMessage(contact: Contact, message: OutreachMessage, now: string): Contact {
  const rank: Record<ContactOutreachStatus, number> = { not_contacted: 0, skipped: 1, draft_prepared: 2, sent: 3, replied: 4 };
  let next: ContactOutreachStatus = contact.outreachStatus;
  let lastContactedAt = contact.lastContactedAt;
  let lastRepliedAt = contact.lastRepliedAt;
  if (message.status === "draft") next = rank[contact.outreachStatus] >= rank.sent ? contact.outreachStatus : "draft_prepared";
  if (message.status === "skipped") next = rank[contact.outreachStatus] >= rank.sent ? contact.outreachStatus : "skipped";
  if (message.status === "sent") {
    next = contact.outreachStatus === "replied" ? "replied" : "sent";
    lastContactedAt = message.sentAt ?? lastContactedAt;
  }
  if (message.status === "replied") {
    next = "replied";
    lastContactedAt = message.sentAt ?? lastContactedAt;
    lastRepliedAt = message.responseRecordedAt ?? now;
  }
  return { ...contact, outreachStatus: next, lastContactedAt, lastRepliedAt, updatedAt: now };
}

export const hasBeenContacted = (c: Pick<Contact, "outreachStatus" | "lastContactedAt">) =>
  c.outreachStatus === "sent" || c.outreachStatus === "replied" || Boolean(c.lastContactedAt);
