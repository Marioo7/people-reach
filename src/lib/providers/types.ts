import type { Contact } from "../types";

/** What a LinkedIn integration can *genuinely* do for this account. Nothing is assumed. */
export type CapabilityStatus = "available" | "unavailable" | "manual_fallback";

export interface Capability {
  status: CapabilityStatus;
  /** Why it is unavailable / what the user must do instead. Shown in the UI. */
  reason: string;
}

export type CapabilityName = "importConnections" | "enrichContact" | "prepareMessage" | "sendMessage" | "attachFile" | "getDeliveryStatus";

export interface ProviderResult<T = undefined> {
  ok: boolean;
  /** Only true when the provider verified the outcome itself. */
  reliable: boolean;
  data?: T;
  error?: string;
}

export interface PreparedMessage {
  profileUrl: string;
  text: string;
  steps: string[];
}

export interface LinkedInProvider {
  readonly id: string;
  readonly label: string;
  capabilities(): Record<CapabilityName, Capability>;
  importConnections(): Promise<ProviderResult<Contact[]>>;
  enrichContact(contact: Contact): Promise<ProviderResult<Partial<Contact>>>;
  prepareMessage(contact: Contact, text: string, hasCv: boolean): ProviderResult<PreparedMessage>;
  sendMessage(contact: Contact, text: string): Promise<ProviderResult>;
  attachFile(contact: Contact, fileId: string): Promise<ProviderResult>;
  getDeliveryStatus(messageId: string): Promise<ProviderResult<"unknown">>;
}
