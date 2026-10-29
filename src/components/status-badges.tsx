"use client";

import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { ClassificationStatus, ContactOutreachStatus, MessageStatus } from "@/lib/types";
import type { DictKey } from "@/lib/i18n-dict";

const CLASS_TONE = { potential: "info", confirmed: "success", not_relevant: "neutral", needs_review: "warning" } as const;
const OUTREACH_TONE = { not_contacted: "neutral", draft_prepared: "info", sent: "success", replied: "success", skipped: "neutral" } as const;
const MSG_TONE = { draft: "info", skipped: "neutral", sent: "success", replied: "success" } as const;

export function ClassificationBadge({ status }: { status: ClassificationStatus }) {
  const { t } = useI18n();
  return <Badge tone={CLASS_TONE[status]}>{t(`class.${status}` as DictKey)}</Badge>;
}
export function OutreachBadge({ status }: { status: ContactOutreachStatus }) {
  const { t } = useI18n();
  return <Badge tone={OUTREACH_TONE[status]}>{t(`outreach.${status}` as DictKey)}</Badge>;
}
export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  const { t } = useI18n();
  return <Badge tone={MSG_TONE[status]}>{t(`review.status.${status}` as DictKey)}</Badge>;
}
export function DemoBadge() {
  const { t } = useI18n();
  return <Badge tone="warning">{t("demo.badge")}</Badge>;
}
