export type ClassificationStatus = "potential" | "confirmed" | "not_relevant" | "needs_review";
export type ReviewStatus = "unreviewed" | "reviewed";
export type ContactOutreachStatus = "not_contacted" | "draft_prepared" | "sent" | "replied" | "skipped";
export type MessageStatus = "draft" | "skipped" | "sent" | "replied";
export type SendingMethod = "linkedin_manual" | "email_manual";
export type ConfirmationMethod = "manual_user_confirmation" | "provider_reliable";

export interface ContactSource {
  type: "linkedin_csv" | "manual" | "demo";
  fileName?: string;
  importedAt: string;
}

export interface Contact {
  id: string;
  ownerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string;
  company: string;
  location: string;
  linkedInProfileUrl: string;
  email: string;
  source: ContactSource;
  /** Raw imported row, preserved untouched. */
  originalData: Record<string, string> | null;
  matchedKeywords: string[];
  matchReason: string;
  classificationStatus: ClassificationStatus;
  reviewStatus: ReviewStatus;
  outreachStatus: ContactOutreachStatus;
  lastContactedAt: string | null;
  lastRepliedAt: string | null;
  connectedOn: string;
  notes: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  ownerId: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: string;
  ownerId: string;
  contactId: string;
  campaignId: string | null;
  templateId: string | null;
  renderedMessage: string;
  status: MessageStatus;
  sendingMethod: SendingMethod;
  cvDocumentId: string | null;
  confirmationMethod: ConfirmationMethod | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  responseRecordedAt: string | null;
  errorMessage: string | null;
}

export interface OutreachCampaign {
  id: string;
  ownerId: string;
  name: string;
  templateId: string | null;
  cvDocumentId: string | null;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CvDocument {
  id: string;
  ownerId: string;
  fileName: string;
  sizeBytes: number;
  /** Number of `cvChunks` documents holding the base64 content. Missing on legacy CV records. */
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Keyword {
  id: string;
  term: string;
  enabled: boolean;
}

export interface UserSettings {
  id: string;
  ownerId: string;
  keywords: Keyword[];
  selectedCvId: string | null;
  defaultTemplateId: string | null;
  senderName: string;
  /** The signed-in user's own LinkedIn profile URL, inserted into messages via {{SenderLinkedIn}}. */
  linkedInProfileUrl: string;
  /** Optional portfolio / website, inserted via {{Portfolio}}. */
  portfolioUrl: string;
  locale: "en" | "ar";
  theme: "light" | "dark" | "system";
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  ownerId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export type CollectionName =
  | "contacts"
  | "messageTemplates"
  | "outreachCampaigns"
  | "outreachMessages"
  | "cvDocuments"
  | "cvChunks"
  | "activityLogs"
  | "userSettings";

export type OwnedDoc = { id: string; ownerId: string };
