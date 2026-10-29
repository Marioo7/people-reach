"use client";

import { useI18n } from "@/lib/i18n";
import type { Contact } from "@/lib/types";

/** Localised explanation of why a contact was (or wasn't) classified as relevant. */
export function useMatchReason() {
  const { t } = useI18n();
  return (c: Contact): string => {
    if (c.reviewStatus === "reviewed") return t("reason.manual");
    const k = c.matchedKeywords.join(", ");
    if (c.matchedKeywords.length) return c.classificationStatus === "needs_review" ? t("reason.keyword_match_tech_role", { k }) : t("reason.keyword_match", { k });
    return c.jobTitle.trim() ? t("reason.no_match") : t("reason.no_title");
  };
}
