"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopy, Download, ExternalLink, Mail, Zap, Pencil, RotateCcw, Save, SkipForward, CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
import { DemoBadge, MessageStatusBadge } from "@/components/status-badges";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Modal, PageHeader, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { downloadCv } from "@/lib/cv-client";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import { mailtoLink, getProvider } from "@/lib/providers/manual";
import { hasBlockingError, validateMessage } from "@/lib/review";
import { extractFirstName } from "@/lib/names";
import { hasBeenContacted } from "@/lib/status";
import { claimsAttachment } from "@/lib/templates";
import type { SendingMethod } from "@/lib/types";

export default function ReviewPage() {
  const { t, locale } = useI18n();
  const { demo, user } = useAuth();
  const { messages, contacts, cvs, selectedCv, settings, saveMessage, markSent, skip, rerender } = useData();

  const queue = useMemo(() => messages.filter((m) => m.status === "draft").sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [messages]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const message = queue.find((m) => m.id === activeId) ?? queue[0] ?? null;
  const contact = message ? contacts.find((c) => c.id === message.contactId) ?? null : null;

  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [okSent, setOkSent] = useState(false);
  const [okAttach, setOkAttach] = useState(false);
  const [okDup, setOkDup] = useState(false);
  const [busy, setBusy] = useState(false);

  const actionsRef = useRef<{ copyOpen(): void; mark(): void; skip(): void; move(d: number): void; modalOpen: boolean; canConfirm: boolean; confirm(): void } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = actionsRef.current;
      if (!a || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (a.modalOpen) {
        if (e.key === "Enter" && a.canConfirm && el.tagName !== "BUTTON") { e.preventDefault(); a.confirm(); }
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "c") { e.preventDefault(); a.copyOpen(); }
      else if (k === "m") { e.preventDefault(); a.mark(); }
      else if (k === "s") { e.preventDefault(); a.skip(); }
      else if (e.key === "ArrowRight" || k === "n") a.move(1);
      else if (e.key === "ArrowLeft" || k === "p") a.move(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setText(message?.renderedMessage ?? "");
    setEditing(false);
  }, [message?.id, message?.renderedMessage]);

  if (!message || !contact) {
    actionsRef.current = null;
    return (
      <>
        <PageHeader title={t("review.title")} description={t("review.subtitle")} />
        <Card><EmptyState icon={<Inbox className="size-6" />} title={t("review.empty")} body={t("review.emptyBody")} action={<Link href="/recruiters"><Button>{t("review.goContacts")}</Button></Link>} /></Card>
      </>
    );
  }

  const cv = cvs.find((c) => c.id === message.cvDocumentId) ?? selectedCv;
  const firstName = extractFirstName(contact.firstName, contact.fullName);
  const warnings = validateMessage({ text, contact, cv: cv ?? null, method: message.sendingMethod, firstNameOk: firstName !== null, sender: { name: settings?.senderName ?? "", linkedIn: settings?.linkedInProfileUrl ?? "", portfolio: settings?.portfolioUrl ?? "" } });
  const blocked = hasBlockingError(warnings);
  const contacted = hasBeenContacted(contact);
  const claims = claimsAttachment(text);
  const dirty = text !== message.renderedMessage;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : null);
  const provider = getProvider();
  const prepared = provider.prepareMessage(contact, text, Boolean(cv));

  const idx = queue.findIndex((m) => m.id === message.id);
  const neighborId = queue[idx + 1]?.id ?? queue[idx - 1]?.id ?? null;
  const move = (d: number) => { const n = queue[idx + d]; if (n) setActiveId(n.id); };
  const afterHandled = () => {
    setActiveId(neighborId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info(neighborId ? t("review.left", { n: queue.length - 1 }) : t("review.queueDone"));
  };
  /** One click: copy the message and open the destination in the same user gesture. Never marks anything as sent. */
  const copyAndOpen = async () => {
    let pending: Promise<void> | null = null;
    try { pending = navigator.clipboard.writeText(text); } catch { pending = null; }
    if (message.sendingMethod === "email_manual" && contact.email) window.location.href = mailtoLink(contact.email, "Frontend Developer opportunities", text);
    else if (contact.linkedInProfileUrl) window.open(contact.linkedInProfileUrl, "_blank", "noopener,noreferrer");
    try { await pending; toast.success(t("review.copied")); } catch { toast.error(t("review.copyFail")); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("review.copied"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };
  const openMethod = () => {
    // Opening a profile / mail client never marks anything as sent.
    if (message.sendingMethod === "email_manual" && contact.email) {
      window.location.href = mailtoLink(contact.email, "Frontend Developer opportunities", text);
    } else if (contact.linkedInProfileUrl) {
      window.open(contact.linkedInProfileUrl, "_blank", "noopener,noreferrer");
    }
  };
  const saveDraft = async () => {
    await saveMessage({ ...message, renderedMessage: text });
    toast.success(t("review.draftSaved"));
  };
  const changeMethod = async (m: SendingMethod) => saveMessage({ ...message, renderedMessage: text, sendingMethod: m });

  const openConfirm = () => {
    setOkSent(false); setOkAttach(false); setOkDup(false);
    setConfirmOpen(true);
  };
  const canConfirm = okSent && (!claims || okAttach) && (!contacted || okDup);
  const confirmSend = async () => {
    setBusy(true);
    try {
      await markSent(message.id, true, text);
      toast.success(t("review.markedSent"));
      setConfirmOpen(false);
      afterHandled();
    } catch {
      toast.error(t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const skipCurrent = async () => {
    await skip(message.id);
    toast.info(t("review.skipped"));
    afterHandled();
  };
  actionsRef.current = {
    copyOpen: () => void copyAndOpen(),
    mark: () => {
      const firstError = warnings.find((w) => w.level === "error");
      if (firstError) toast.error(t(`warn.${firstError.code}` as DictKey));
      else openConfirm();
    },
    skip: () => void skipCurrent(),
    move,
    modalOpen: confirmOpen,
    canConfirm: canConfirm && !busy,
    confirm: () => void confirmSend(),
  };

  return (
    <>
      <PageHeader title={t("review.title")} description={t("review.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit">
          <CardHeader title={t("review.queue", { n: queue.length })} />
          <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
            {queue.map((m) => {
              const c = contacts.find((x) => x.id === m.contactId);
              return (
                <li key={m.id}>
                  <button onClick={() => setActiveId(m.id)} className={cn("w-full px-4 py-3 text-start text-sm hover:bg-muted", m.id === message.id && "bg-primary/10")} aria-current={m.id === message.id}>
                    <div className="font-medium">{c?.fullName ?? "?"}</div>
                    <div className="truncate text-xs text-muted-foreground">{[c?.jobTitle, c?.company].filter(Boolean).join(" · ")}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={<span className="flex flex-wrap items-center gap-2">{contact.fullName}{contact.isDemo && <DemoBadge />}<MessageStatusBadge status={message.status} /></span>}
              description={[contact.jobTitle, contact.company].filter(Boolean).join(" · ") || t("common.none")}
              action={<Link href={`/contact?id=${contact.id}`} className="text-sm text-primary hover:underline">{t("details.title")}</Link>}
            />
            <CardBody className="space-y-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">{t("common.profileUrl")}</dt><dd className="truncate" dir="ltr">{contact.linkedInProfileUrl ? <a className="text-primary hover:underline" href={contact.linkedInProfileUrl} target="_blank" rel="noopener noreferrer">{contact.linkedInProfileUrl}</a> : t("contacts.noUrl")}</dd></div>
                <div><dt className="text-muted-foreground">{t("review.matched")}</dt><dd>{contact.matchedKeywords.length ? contact.matchedKeywords.map((k) => <Badge key={k} className="me-1">{k}</Badge>) : t("common.none")}</dd></div>
                <div><dt className="text-muted-foreground">{t("review.cv")}</dt><dd>{cv ? (<span className="flex flex-wrap items-center gap-2"><span dir="auto">{cv.fileName}</span><Button size="sm" variant="outline" onClick={() => void downloadCv({ demo, ownerId: user?.uid ?? "", cv }).catch(() => toast.error(t("common.errorGeneric")))}><Download className="size-4" />{t("review.downloadCv")}</Button></span>) : <span className="text-danger">{t("review.noCv")}</span>}{cv && claims && <span className="mt-1 block text-xs text-muted-foreground">{t("review.cvHint")}</span>}</dd></div>
                <div><dt className="text-muted-foreground">{t("review.history")}</dt><dd>{contacted ? `${t(`outreach.${contact.outreachStatus}` as DictKey)} · ${fmt(contact.lastContactedAt) ?? ""}` : t("review.never")}</dd></div>
              </dl>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block font-medium">{t("review.method")}</span>
                  <Select value={message.sendingMethod} onChange={(e) => void changeMethod(e.target.value as SendingMethod)}>
                    <option value="linkedin_manual">{t("review.method.linkedin_manual")}</option><option value="email_manual">{t("review.method.email_manual")}</option>
                  </Select>
                </label>
                <div className="text-sm"><span className="mb-1 block font-medium">{t("review.methodAvail")}</span>
                  <p className="text-muted-foreground">{message.sendingMethod === "email_manual" ? t("review.avail.email") : t("review.avail.linkedin")}</p>
                </div>
              </div>

              {warnings.map((w) => <Alert key={w.code} tone={w.level === "error" ? "danger" : w.level === "warning" ? "warning" : "info"}>{t(`warn.${w.code}` as DictKey)}</Alert>)}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{t("review.message")}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void rerender(message.id).then(() => toast.success(t("common.saved")))}><RotateCcw className="size-4" />{t("review.rerender")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}><Pencil className="size-4" />{t("common.edit")}</Button>
                  </div>
                </div>
                <Textarea rows={16} value={text} readOnly={!editing} onChange={(e) => setText(e.target.value)} dir="auto" aria-label={t("review.message")} className={cn(!editing && "bg-muted/50")} />
              </div>

              {message.sendingMethod === "linkedin_manual" && prepared.ok && (
                <details className="rounded-lg border border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">{t("review.steps")}</summary>
                  <ol className="mt-2 list-decimal space-y-1 ps-5 text-muted-foreground">
                    <li>{t("review.step1")}</li><li>{t("review.step2")}</li><li>{cv ? t("review.step3") : t("review.noCv")}</li><li>{t("review.step4")}</li>
                  </ol>
                </details>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void copyAndOpen()}><Zap className="size-4" />{t("review.copyOpen")}</Button>
                <Button variant="outline" onClick={() => void copy()}><ClipboardCopy className="size-4" />{t("review.copy")}</Button>
                <Button variant="outline" disabled={!contact.linkedInProfileUrl} onClick={() => window.open(contact.linkedInProfileUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />{t("review.openProfile")}</Button>
                <Button variant="outline" disabled={message.sendingMethod === "email_manual" ? !contact.email : !contact.linkedInProfileUrl} onClick={openMethod}>{message.sendingMethod === "email_manual" ? <Mail className="size-4" /> : <ExternalLink className="size-4" />}{t("review.openMethod")}</Button>
                <Button variant="secondary" disabled={!dirty} onClick={() => void saveDraft()}><Save className="size-4" />{t("review.saveDraft")}</Button>
                <Button variant="ghost" onClick={() => void skipCurrent()}><SkipForward className="size-4" />{t("review.skip")}</Button>
                <Button className="ms-auto" disabled={blocked} onClick={openConfirm}><CheckCheck className="size-4" />{t("review.markSent")}</Button>
              </div>
              <p className="hidden text-xs text-muted-foreground md:block">{t("review.shortcuts")}</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Phones have no keyboard shortcuts: a sticky bar keeps the three main actions one tap away. */}
      <div className="h-24 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-card/95 p-3 backdrop-blur md:hidden">
        <Button className="flex-1" onClick={() => void copyAndOpen()}><Zap className="size-4" />{t("review.copyOpen")}</Button>
        <Button className="flex-1" variant="outline" disabled={blocked} onClick={openConfirm}><CheckCheck className="size-4" />{t("review.markSent")}</Button>
        <Button variant="ghost" aria-label={t("review.skip")} onClick={() => void skipCurrent()}><SkipForward className="size-4" /></Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("review.confirmTitle")}
        footer={<><Button variant="outline" onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button><Button disabled={!canConfirm || busy} onClick={() => void confirmSend()}>{t("review.markSent")}</Button></>}
      >
        <p>{t("review.confirmBody", { name: contact.fullName })}</p>
        {contacted && <Alert tone="warning">{t("warn.already_contacted")}</Alert>}
        <Checkbox id="ok-sent" checked={okSent} onChange={setOkSent} label={t("review.confirmSent")} />
        {claims && <Checkbox id="ok-attach" checked={okAttach} onChange={setOkAttach} label={t("review.confirmAttach")} />}
        {contacted && <Checkbox id="ok-dup" checked={okDup} onChange={setOkDup} label={t("review.confirmDup")} />}
      </Modal>
    </>
  );
}
