"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Clock, Inbox, MailCheck, MessageSquareReply, PenLine, UserSearch, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";

function GettingStarted() {
  const { t } = useI18n();
  const { settings, cvs, contacts } = useData();
  const items = [
    { done: Boolean(settings?.senderName.trim() && settings?.linkedInProfileUrl.trim()), label: t("start.profile"), href: "/settings" },
    { done: cvs.length > 0, label: t("start.cv"), href: "/cv" },
    { done: contacts.some((c) => !c.isDemo), label: t("start.import"), href: "/import" },
  ];
  if (items.every((i) => i.done)) return null;
  return (
    <Card className="mb-6">
      <CardHeader title={t("start.title")} />
      <CardBody>
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.href} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">{i.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}<span className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</span></span>
              {!i.done && <Link href={i.href}><Button size="sm" variant="outline">{t("start.go")}</Button></Link>}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { t, tx, locale } = useI18n();
  const { contacts, messages, logs, loadDemo } = useData();

  const potential = contacts.filter((c) => c.classificationStatus === "potential").length;
  const confirmed = contacts.filter((c) => c.classificationStatus === "confirmed").length;
  const awaiting = contacts.filter((c) => c.reviewStatus === "unreviewed" && c.classificationStatus !== "not_relevant").length;
  const drafts = messages.filter((m) => m.status === "draft").length;
  const prepared = messages.length;
  const sent = messages.filter((m) => m.status === "sent" || m.status === "replied").length;
  const replies = messages.filter((m) => m.status === "replied").length;

  if (!contacts.length) {
    return (
      <>
        <PageHeader title={t("dash.title")} description={t("dash.subtitle")} />
        <GettingStarted />
        <Card>
          <EmptyState
            icon={<Inbox className="size-6" />}
            title={t("dash.emptyTitle")}
            body={t("dash.emptyBody")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/import"><Button>{t("dash.goImport")}</Button></Link>
                <Button variant="outline" onClick={() => void loadDemo().then(() => toast.success(t("demo.badge")))}>{t("dash.loadDemo")}</Button>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const label = (a: string) => tx(`log.${a}`, a);

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.subtitle")} />
      <GettingStarted />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("dash.total")} value={contacts.length} icon={<Users className="size-5" />} />
        <StatCard label={t("dash.potential")} value={potential} icon={<UserSearch className="size-5" />} />
        <StatCard label={t("dash.confirmed")} value={confirmed} icon={<CheckCircle2 className="size-5" />} tone="success" />
        <StatCard label={t("dash.awaiting")} value={awaiting} icon={<Clock className="size-5" />} tone="warning" />
        <StatCard label={t("dash.prepared")} value={prepared} icon={<PenLine className="size-5" />} />
        <StatCard label={t("dash.sent")} value={sent} icon={<MailCheck className="size-5" />} tone="success" />
        <StatCard label={t("dash.responses")} value={replies} icon={<MessageSquareReply className="size-5" />} tone="success" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("dash.recent")} />
          <CardBody>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dash.noActivity")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {logs.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{label(l.action)}{l.details ? <span className="text-muted-foreground"> — {l.details}</span> : null}</span>
                    <time className="shrink-0 text-xs text-muted-foreground">{fmt(l.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dash.pipeline")} />
          <CardBody className="space-y-2 text-sm">
            {[["/import", "nav.import"], ["/recruiters", "nav.recruiters"], ["/review", "nav.review"], ["/history", "nav.history"]].map(([href, key], i) => (
              <Link key={href} href={href as string} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                {t(key as DictKey)}
              </Link>
            ))}
            {drafts > 0 && <Link href="/review" className="mt-2 block rounded-lg bg-primary/10 px-3 py-2 text-primary">{t("dash.queue", { n: drafts })}</Link>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
