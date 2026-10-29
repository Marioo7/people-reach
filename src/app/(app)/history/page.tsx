"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { History as HistoryIcon, RotateCcw, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { MessageStatusBadge } from "@/components/status-badges";
import { Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Select } from "@/components/ui";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import type { MessageStatus } from "@/lib/types";

export default function HistoryPage() {
  const { t, tx, locale } = useI18n();
  const { messages, contacts, logs, reply, reopen } = useData();
  const [status, setStatus] = useState<MessageStatus | "all">("all");
  const rows = useMemo(() => messages.filter((m) => status === "all" || m.status === status).sort((a, b) => (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt)), [messages, status]);
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : t("common.none"));

  return (
    <>
      <PageHeader title={t("hist.title")} description={t("hist.subtitle")} actions={
        <Select className="w-44" aria-label={t("hist.filter")} value={status} onChange={(e) => setStatus(e.target.value as MessageStatus | "all")}>
          <option value="all">{t("common.all")}</option>
          {(["draft", "sent", "replied", "skipped"] as const).map((s) => <option key={s} value={s}>{t(`review.status.${s}` as DictKey)}</option>)}
        </Select>} />
      <Card className="overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={<HistoryIcon className="size-6" />} title={t("hist.empty")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted text-xs text-muted-foreground"><tr>
                {["common.name", "common.company", "common.status", "hist.method", "hist.confirmed", "common.lastContact", "common.actions"].map((k) => <th key={k} className="px-3 py-2 text-start font-medium">{t(k as DictKey)}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((m) => {
                  const c = contacts.find((x) => x.id === m.contactId);
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{c ? <Link href={`/contact?id=${c.id}`} className="hover:underline">{c.fullName}</Link> : "?"}</td>
                      <td className="px-3 py-2">{c?.company || t("common.none")}</td>
                      <td className="px-3 py-2"><MessageStatusBadge status={m.status} /></td>
                      <td className="px-3 py-2">{t(`review.method.${m.sendingMethod}` as DictKey)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{m.confirmationMethod ? t(`hist.conf.${m.confirmationMethod}` as DictKey) : t("common.none")}</td>
                      <td className="whitespace-nowrap px-3 py-2">{fmt(m.sentAt)}</td>
                      <td className="px-3 py-2">
                        {m.status === "sent" && <Button size="sm" variant="outline" onClick={() => void reply(m.id).then(() => toast.success(t("hist.replyRecorded")))}><MessageSquareReply className="size-4" />{t("hist.recordReply")}</Button>}
                        {m.status === "skipped" && <Button size="sm" variant="outline" onClick={() => void reopen(m.id)}><RotateCcw className="size-4" />{t("review.reopen")}</Button>}
                        {m.status === "draft" && <Link href="/review"><Button size="sm" variant="outline">{t("nav.review")}</Button></Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="mt-6">
        <CardHeader title={t("hist.activity")} />
        <CardBody>
          <ul className="divide-y divide-border text-sm">
            {logs.slice(0, 30).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2"><span>{tx(`log.${l.action}`, l.action)}{l.details && <span className="text-muted-foreground"> — {l.details}</span>}</span><time className="shrink-0 text-xs text-muted-foreground">{fmt(l.createdAt)}</time></li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
