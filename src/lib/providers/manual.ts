import type { Contact } from "../types";
import type { Capability, CapabilityName, LinkedInProvider, ProviderResult } from "./types";

const UNSUPPORTED = (reason: string): Capability => ({ status: "unavailable", reason });

/**
 * The only provider that is verified to work for this project: manual, user-driven.
 *
 * Verified limitations (checked against LinkedIn's official documentation):
 *  - LinkedIn exposes no public API to read a member's connections or to send direct messages
 *    to third-party developers; messaging APIs are restricted to approved partners.
 *  - The Member Data Portability API is read-only and only available to members located in the
 *    EU/EEA/Switzerland, so it cannot be relied upon for this account and cannot send anything.
 *  - Therefore: import = official "Download your data" CSV; sending = user does it in LinkedIn.
 */
export const manualProvider: LinkedInProvider = {
  id: "manual",
  label: "Manual (official CSV export + user-sent message)",

  capabilities(): Record<CapabilityName, Capability> {
    return {
      importConnections: { status: "manual_fallback", reason: "Import the Connections.csv file from LinkedIn's official 'Get a copy of your data' export." },
      enrichContact: { status: "manual_fallback", reason: "No authorized profile-data API is available. Edit job title and company manually." },
      prepareMessage: { status: "available", reason: "Personalised text is prepared locally and copied for you." },
      sendMessage: UNSUPPORTED("LinkedIn does not offer a messaging API for individual developers. You send the message yourself and confirm it."),
      attachFile: UNSUPPORTED("Files cannot be attached through an API. Attach the PDF manually in LinkedIn's message window."),
      getDeliveryStatus: UNSUPPORTED("Delivery cannot be verified automatically. Mark as sent only after you actually sent it."),
    };
  },

  async importConnections(): Promise<ProviderResult<Contact[]>> {
    return { ok: false, reliable: false, error: "Use the CSV import page." };
  },
  async enrichContact(): Promise<ProviderResult<Partial<Contact>>> {
    return { ok: false, reliable: false, error: this.capabilities().enrichContact.reason };
  },
  prepareMessage(contact, text, hasCv) {
    if (!contact.linkedInProfileUrl) {
      return { ok: false, reliable: false, error: "This contact has no LinkedIn profile URL." };
    }
    const steps = [
      "Open the LinkedIn profile.",
      "Click “Message” and paste the copied text.",
      hasCv ? "Attach your CV PDF manually using the paperclip icon." : "No CV selected — remove the attachment sentence or select a CV first.",
      "Review, send the message yourself, then come back and confirm.",
    ];
    return { ok: true, reliable: false, data: { profileUrl: contact.linkedInProfileUrl, text, steps } };
  },
  async sendMessage() {
    return { ok: false, reliable: false, error: this.capabilities().sendMessage.reason };
  },
  async attachFile() {
    return { ok: false, reliable: false, error: this.capabilities().attachFile.reason };
  },
  async getDeliveryStatus() {
    return { ok: false, reliable: false, error: this.capabilities().getDeliveryStatus.reason };
  },
};

export function getProvider(): LinkedInProvider {
  return manualProvider;
}

export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
