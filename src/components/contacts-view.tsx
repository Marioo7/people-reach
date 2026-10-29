"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { ClassificationBadge, DemoBadge, OutreachBadge } from "@/components/status-badges";
import { useMatchReason } from "@/components/use-match-reason";
import { Alert, Button, Card, CardBody, EmptyState, Input, Modal, PageHeader, Pagination, Select } from "@/components/ui";
import { useData } from "@/lib/data/data-context";
import { EMPTY_FILTERS, filterContacts, paginate, sortContacts, type ContactFilters, type SortKey } from "@/lib/filters";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import type { ClassificationStatus, SendingMethod } from "@/lib/types";

/** People you already contacted are hidden by default so they are never picked twice. */
const DEFAULT_VIEW_FILTERS: ContactFilters = { ...EMPTY_FILTERS, contacted: "not_contacted" };

export function ContactsView({ mode }: { mode: "all" | "recruiters" }) {
  const { t, locale } = useI18n();
  const { contacts, templates, settings, setClassification, prepareMessages } = useData();
  const router = useRouter();
  const reasonOf = useMatchReason();

  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_VIEW_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPrepare, setShowPrepare] = useState(false);
  const [templateId, setTemplateId] = useState(settings?.defaultTemplateId ?? templates[0]?.id ?? "");
  const [method, setMethod] = useState<SendingMethod>("linkedin_manual");
  const [busy, setBusy] = useState(false);

  const base = useMemo(() => (mode === "recruiters" ? contacts.filter((c) => c.classificationStatus !== "not_relevant") : contacts), [contacts, mode]);
  const filtered = useMemo(() => sortContacts(filterContacts(base, filters), sortKey, dir), [base, filters, sortKey, dir]);
  const pageData = paginate(filtered, page, pageSize);
  const set = <K extends keyof ContactFilters>(k: K, v: ContactFilters[K]) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setDir("asc"); }
  };
  const allOnPage = pageData.items.length > 0 && pageData.items.every((c) => selected.has(c.id));
  const toggleAll = (v: boolean) => setSelected((s) => { const n = new Set(s); pageData.items.forEach((c) => (v ? n.add(c.id) : n.delete(c.id))); return n; });
  const toggleOne = (id: string, v: boolean) => setSelected((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });

  const bulkClassify = async (status: ClassificationStatus) => {
    await setClassification([...selected], status);
    toast.success(t("common.saved"));
  };

  const prepare = async () => {
    setBusy(true);
    try {
      const r = await prepareMessages([...selected], templateId, method);
      if (r.created) toast.success(t("contacts.prepared", { n: r.created }));
      if (r.reused) toast.info(t("contacts.preparedReused", { n: r.reused }));
      if (r.skippedContacted) toast.info(t("contacts.preparedSkipped", { n: r.skippedContacted }));
      setSelected(new Set());
      setShowPrepare(false);
      if (r.created || r.reused) router.push("/review");
    } catch {
      toast.error(t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2 text-start font-medium" aria-sort={sortKey === k ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
        {label}{sortKey === k && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : t("common.none"));
  const title = mode === "all" ? t("contacts.title") : t("contacts.recruitersTitle");

  return (
    <>
      <PageHeader
        title={title}
        description={mode === "recruiters" ? t("contacts.recruitersSub") : undefined}
        actions={selected.size > 0 && <Button onClick={() => setShowPrepare(true)}><Send className="size-4" />{t("contacts.prepare")} ({selected.size})</Button>}
      />
      <Card>
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder={t("contacts.search")} value={filters.search} onChange={(e) => set("search", e.target.value)} aria-label={t("common.search")} />
            <Input placeholder={t("common.jobTitle")} value={filters.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} aria-label={t("common.jobTitle")} />
            <Input placeholder={t("common.company")} value={filters.company} onChange={(e) => set("company", e.target.value)} aria-label={t("common.company")} />
            <Input placeholder={t("common.location")} value={filters.location} onChange={(e) => set("location", e.target.value)} aria-label={t("common.location")} />
            <Select aria-label={t("contacts.classification")} value={filters.classification} onChange={(e) => set("classification", e.target.value as ContactFilters["classification"])}>
              <option value="all">{t("contacts.classification")}: {t("common.all")}</option>
              {(["potential", "confirmed", "needs_review", "not_relevant"] as const).map((s) => <option key={s} value={s}>{t(`class.${s}` as DictKey)}</option>)}
            </Select>
            <Select aria-label={t("contacts.relevance")} value={filters.relevance} onChange={(e) => set("relevance", e.target.value as ContactFilters["relevance"])}>
              {(["all", "relevant", "unreviewed", "not_relevant"] as const).map((v) => <option key={v} value={v}>{t("contacts.relevance")}: {t(`contacts.rel.${v}` as DictKey)}</option>)}
            </Select>
            <Select aria-label={t("contacts.profile")} value={filters.profile} onChange={(e) => set("profile", e.target.value as ContactFilters["profile"])}>
              <option value="all">{t("contacts.profile")}: {t("common.all")}</option>
              <option value="with_url">{t("contacts.prof.with_url")}</option>
              <option value="without_url">{t("contacts.prof.without_url")}</option>
            </Select>
            <Select aria-label={t("contacts.contacted")} value={filters.contacted} onChange={(e) => set("contacted", e.target.value as ContactFilters["contacted"])}>
              <option value="all">{t("contacts.contacted")}: {t("common.all")}</option>
              <option value="contacted">{t("contacts.con.contacted")}</option>
              <option value="not_contacted">{t("contacts.con.not_contacted")}</option>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{t("common.rowsOf", { a: filtered.length, b: base.length })}{filters.contacted === "not_contacted" && <span className="ms-2 text-xs">· {t("contacts.hiddenNote")}</span>}</span>
            <Button variant="ghost" size="sm" onClick={() => { setFilters(DEFAULT_VIEW_FILTERS); setPage(1); }}>{t("common.clear")}</Button>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2 text-sm">
              <span className="px-1 font-medium">{t("common.selected", { n: selected.size })}</span>
              <span className="text-muted-foreground">{t("contacts.markStatus")}:</span>
              {(["confirmed", "needs_review", "not_relevant"] as const).map((s) => <Button key={s} size="sm" variant="outline" onClick={() => void bulkClassify(s)}>{t(`class.${s}` as DictKey)}</Button>)}
              <span className="ms-auto text-xs text-muted-foreground">{t("contacts.bulkNote")}</span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title={contacts.length ? t("contacts.empty") : t("contacts.emptyNone")} action={!contacts.length ? <Link href="/import"><Button>{t("nav.import")}</Button></Link> : undefined} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={allOnPage} onChange={(e) => toggleAll(e.target.checked)} aria-label="select all" /></th>
                    <Th k="fullName" label={t("common.name")} />
                    <Th k="firstName" label={t("common.firstName")} />
                    <Th k="jobTitle" label={t("common.jobTitle")} />
                    <Th k="company" label={t("common.company")} />
                    <th className="px-3 py-2 text-start font-medium">{t("common.profileUrl")}</th>
                    <th className="px-3 py-2 text-start font-medium">{t("contacts.matchReason")}</th>
                    <Th k="classificationStatus" label={t("common.status")} />
                    <Th k="lastContactedAt" label={t("common.lastContact")} />
                    <th className="px-3 py-2 text-start font-medium">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((c) => (
                    <tr key={c.id} className="border-t border-border align-top hover:bg-muted/40">
                      <td className="px-3 py-2"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={selected.has(c.id)} onChange={(e) => toggleOne(c.id, e.target.checked)} aria-label={c.fullName} /></td>
                      <td className="px-3 py-2 font-medium"><Link href={`/contact?id=${c.id}`} className="hover:underline">{c.fullName}</Link>{c.isDemo && <span className="ms-2"><DemoBadge /></span>}</td>
                      <td className="px-3 py-2">{c.firstName || <span className="text-danger">{t("common.none")}</span>}</td>
                      <td className="px-3 py-2">{c.jobTitle || t("common.none")}</td>
                      <td className="px-3 py-2">{c.company || t("common.none")}</td>
                      <td className="max-w-[14rem] truncate px-3 py-2" dir="ltr">
                        {c.linkedInProfileUrl ? <a href={c.linkedInProfileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.linkedInProfileUrl.replace("https://www.linkedin.com", "")}</a> : t("contacts.noUrl")}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2 text-xs text-muted-foreground">{reasonOf(c)}</td>
                      <td className="space-y-1 px-3 py-2"><ClassificationBadge status={c.classificationStatus} /><div><OutreachBadge status={c.outreachStatus} /></div></td>
                      <td className="whitespace-nowrap px-3 py-2">{fmtDate(c.lastContactedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Link href={`/contact?id=${c.id}`}><Button size="sm" variant="outline">{t("common.view")}</Button></Link>
                          {c.linkedInProfileUrl && <a href={c.linkedInProfileUrl} target="_blank" rel="noopener noreferrer" aria-label={t("contacts.openProfile")}><Button size="sm" variant="ghost"><ExternalLink className="size-4" /></Button></a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pt-3 text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">{t("contacts.pageSize")}
                <Select className="h-8 w-20" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}</Select>
              </label>
            </div>
            <Pagination page={pageData.page} totalPages={pageData.totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={showPrepare} onClose={() => setShowPrepare(false)} title={t("contacts.prepare")} footer={<><Button variant="outline" onClick={() => setShowPrepare(false)}>{t("common.cancel")}</Button><Button disabled={busy || !templateId} onClick={() => void prepare()}>{t("contacts.prepare")}</Button></>}>
        <Alert tone="info">{t("contacts.bulkNote")}</Alert>
        <label className="block"><span className="mb-1 block font-medium">{t("contacts.template")}</span>
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        </label>
        <label className="block"><span className="mb-1 block font-medium">{t("contacts.method")}</span>
          <Select value={method} onChange={(e) => setMethod(e.target.value as SendingMethod)}>
            <option value="linkedin_manual">{t("review.method.linkedin_manual")}</option><option value="email_manual">{t("review.method.email_manual")}</option>
          </Select>
        </label>
      </Modal>
    </>
  );
}
