"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ClassificationBadge, DemoBadge, MessageStatusBadge, OutreachBadge } from "@/components/status-badges";
import { useMatchReason } from "@/components/use-match-reason";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { buildFullName, extractFirstName } from "@/lib/names";
import { normalizeLinkedInUrl } from "@/lib/csv/parse";
import { applyClassification } from "@/lib/classify";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";

const schema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  jobTitle: z.string().trim().max(200),
  company: z.string().trim().max(200),
  location: z.string().trim().max(200),
  email: z.string().trim().max(254).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "invalid"),
  linkedInProfileUrl: z.string().trim().max(300).refine((v) => !v || normalizeLinkedInUrl(v) !== "", "invalid"),
  notes: z.string().max(2000),
});
type Form = z.infer<typeof schema>;

function ContactDetail() {
  const id = useSearchParams().get("id") ?? "";
  const { t, locale } = useI18n();
  const { contacts, messages, settings, saveContact, setClassification } = useData();
  const reasonOf = useMatchReason();
  const contact = contacts.find((c) => c.id === id);
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (contact) reset({ firstName: contact.firstName, lastName: contact.lastName, jobTitle: contact.jobTitle, company: contact.company, location: contact.location, email: contact.email, linkedInProfileUrl: contact.linkedInProfileUrl, notes: contact.notes });
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!contact) return <Card><EmptyState title={t("details.notFound")} action={<Link href="/contacts"><Button variant="outline">{t("common.back")}</Button></Link>} /></Card>;

  const history = messages.filter((m) => m.contactId === contact.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const w = watch();
  const nameOk = extractFirstName(w.firstName, buildFullName(w.firstName ?? "", w.lastName ?? "")) !== null;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB") : t("common.none"));

  const onSubmit = async (v: Form) => {
    const url = v.linkedInProfileUrl ? normalizeLinkedInUrl(v.linkedInProfileUrl) : "";
    let next = { ...contact, ...v, linkedInProfileUrl: url, fullName: buildFullName(v.firstName, v.lastName) || contact.fullName };
    next = applyClassification(next, settings?.keywords ?? []);
    await saveContact(next, "contact_updated");
    reset(v);
    toast.success(t("details.edited"));
  };

  return (
    <>
      <PageHeader
        title={contact.fullName}
        description={[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
        actions={<>
          {contact.isDemo && <DemoBadge />}
          <ClassificationBadge status={contact.classificationStatus} />
          <OutreachBadge status={contact.outreachStatus} />
          {contact.linkedInProfileUrl && <a href={contact.linkedInProfileUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><ExternalLink className="size-4" />{t("contacts.openProfile")}</Button></a>}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("details.title")} />
          <CardBody>
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              {!nameOk && <Alert tone="warning">{t("details.nameWarning")}</Alert>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="firstName">{t("common.firstName")}</Label><Input id="firstName" {...register("firstName")} /></div>
                <div><Label htmlFor="lastName">{t("common.lastName")}</Label><Input id="lastName" {...register("lastName")} /></div>
                <div><Label htmlFor="jobTitle">{t("common.jobTitle")}</Label><Input id="jobTitle" {...register("jobTitle")} /></div>
                <div><Label htmlFor="company">{t("common.company")}</Label><Input id="company" {...register("company")} /></div>
                <div><Label htmlFor="location">{t("common.location")}</Label><Input id="location" {...register("location")} /></div>
                <div><Label htmlFor="email">{t("common.email")}</Label><Input id="email" type="email" dir="ltr" aria-invalid={!!errors.email} {...register("email")} />{errors.email && <p className="mt-1 text-xs text-danger">{t("issue.invalid_email")}</p>}</div>
                <div className="sm:col-span-2"><Label htmlFor="url">{t("common.profileUrl")}</Label><Input id="url" dir="ltr" aria-invalid={!!errors.linkedInProfileUrl} {...register("linkedInProfileUrl")} />{errors.linkedInProfileUrl && <p className="mt-1 text-xs text-danger">{t("issue.invalid_profile_url")}</p>}</div>
                <div className="sm:col-span-2"><Label htmlFor="notes">{t("common.notes")}</Label><Textarea id="notes" rows={4} {...register("notes")} /></div>
              </div>
              <Button type="submit" disabled={!isDirty}>{t("details.save")}</Button>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("contacts.classification")} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted-foreground">{reasonOf(contact)}</p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => void setClassification([contact.id], "confirmed").then(() => toast.success(t("common.saved")))}>{t("details.setConfirmed")}</Button>
                <Button variant="outline" size="sm" onClick={() => void setClassification([contact.id], "not_relevant").then(() => toast.success(t("common.saved")))}>{t("details.setNotRelevant")}</Button>
                <Button variant="outline" size="sm" onClick={() => void setClassification([contact.id], "needs_review").then(() => toast.success(t("common.saved")))}>{t("details.setNeedsReview")}</Button>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("details.source")} />
            <CardBody className="space-y-1 text-sm">
              <div>{contact.source.type}{contact.source.fileName ? ` · ${contact.source.fileName}` : ""}</div>
              <div className="text-muted-foreground">{fmt(contact.source.importedAt)}</div>
              {contact.connectedOn && <div className="text-muted-foreground">{t("field.connectedOn")}: {contact.connectedOn}</div>}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title={t("details.history")} />
        <CardBody>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">{t("details.noHistory")}</p> : (
            <ul className="divide-y divide-border text-sm">
              {history.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2"><span className="flex items-center gap-2"><MessageStatusBadge status={m.status} />{fmt(m.sentAt ?? m.createdAt)}</span></li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {contact.originalData && (
        <Card className="mt-6">
          <CardHeader title={t("details.original")} />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(contact.originalData).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="font-medium">{k}:</dt><dd className="min-w-0 break-words text-muted-foreground" dir="auto">{v || t("common.none")}</dd></div>)}
            </dl>
          </CardBody>
        </Card>
      )}
    </>
  );
}

export default function ContactDetailPage() {
  return (
    <Suspense fallback={null}>
      <ContactDetail />
    </Suspense>
  );
}
