"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { normalizeLinkedInUrl } from "@/lib/csv/parse";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Input, Label, Modal, PageHeader } from "@/components/ui";
import { DEFAULT_KEYWORDS } from "@/lib/classify";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import { getProvider } from "@/lib/providers/manual";
import type { Keyword } from "@/lib/types";
import { newId } from "@/lib/utils";

const profileSchema = z.object({
  senderName: z.string().trim().min(1, "name").max(100),
  linkedInProfileUrl: z.string().trim().max(300).refine((v) => !v || normalizeLinkedInUrl(v) !== "", "linkedin"),
  portfolioUrl: z.string().trim().max(300).refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "url"),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileCard() {
  const { t } = useI18n();
  const { settings, saveSettings } = useData();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  useEffect(() => {
    if (settings) reset({ senderName: settings.senderName, linkedInProfileUrl: settings.linkedInProfileUrl, portfolioUrl: settings.portfolioUrl });
  }, [settings?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!settings) return null;
  const onSubmit = async (v: ProfileForm) => {
    await saveSettings({ senderName: v.senderName, linkedInProfileUrl: v.linkedInProfileUrl ? normalizeLinkedInUrl(v.linkedInProfileUrl) : "", portfolioUrl: v.portfolioUrl }, "settings_updated");
    reset(v);
    toast.success(t("profile.saved"));
  };
  return (
    <Card className="mb-6">
      <CardHeader title={t("profile.title")} description={t("profile.desc")} />
      <CardBody>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div><Label htmlFor="pname">{t("profile.name")}</Label><Input id="pname" maxLength={100} aria-invalid={!!errors.senderName} {...register("senderName")} />{errors.senderName && <p className="mt-1 text-xs text-danger">{t("profile.errName")}</p>}</div>
          <div><Label htmlFor="plinkedin">{t("profile.linkedin")}</Label><Input id="plinkedin" dir="ltr" placeholder="https://www.linkedin.com/in/your-name" aria-invalid={!!errors.linkedInProfileUrl} {...register("linkedInProfileUrl")} />{errors.linkedInProfileUrl && <p className="mt-1 text-xs text-danger">{t("profile.errLinkedin")}</p>}</div>
          <div className="sm:col-span-2"><Label htmlFor="pportfolio">{t("profile.portfolio")}</Label><Input id="pportfolio" dir="ltr" placeholder="https://" aria-invalid={!!errors.portfolioUrl} {...register("portfolioUrl")} />{errors.portfolioUrl && <p className="mt-1 text-xs text-danger">{t("profile.errPortfolio")}</p>}</div>
          <div className="sm:col-span-2"><Button type="submit" disabled={!isDirty}>{t("common.save")}</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { settings, saveSettings, reclassify, contacts, removeDemo } = useData();
  const [newKw, setNewKw] = useState("");
  const [confirmDemo, setConfirmDemo] = useState(false);
  if (!settings) return null;

  const keywords = settings.keywords;
  const caps = getProvider().capabilities();
  const demoCount = contacts.filter((c) => c.isDemo).length;
  const update = (next: Keyword[]) => saveSettings({ keywords: next }, "keywords_updated");

  const add = async () => {
    const term = newKw.trim();
    if (!term) return;
    if (keywords.some((k) => k.term.toLowerCase() === term.toLowerCase())) return void toast.error(t("set.kwExists"));
    await update([...keywords, { id: newId("kw"), term: term.slice(0, 80), enabled: true }]);
    setNewKw("");
    toast.success(t("set.kwSaved"));
  };
  const edit = (id: string, term: string) => update(keywords.map((k) => (k.id === id ? { ...k, term: term.slice(0, 80) } : k)));

  return (
    <>
      <PageHeader title={t("set.title")} description={t("set.subtitle")} />
      <ProfileCard />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("set.keywords")} description={t("set.keywordsHint")} />
          <CardBody className="space-y-4">
            <div className="flex gap-2">
              <Input value={newKw} placeholder={t("set.keywordPlaceholder")} onChange={(e) => setNewKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} aria-label={t("set.addKeyword")} />
              <Button onClick={() => void add()} disabled={!newKw.trim()}><Plus className="size-4" />{t("set.addKeyword")}</Button>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {keywords.map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox checked={k.enabled} onChange={(v) => void update(keywords.map((x) => (x.id === k.id ? { ...x, enabled: v } : x)))} label={<span className="sr-only">{k.term}</span>} />
                  <Input defaultValue={k.term} className="h-8" onBlur={(e) => e.target.value.trim() && e.target.value !== k.term && void edit(k.id, e.target.value.trim())} aria-label={k.term} />
                  <Button variant="ghost" size="sm" aria-label={t("common.remove")} onClick={() => void update(keywords.filter((x) => x.id !== k.id))}><Trash2 className="size-4" /></Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void reclassify().then((n) => toast.success(t("set.reclassified", { n })))}>{t("set.reclassify")}</Button>
              <Button variant="outline" onClick={() => void update(DEFAULT_KEYWORDS.map((term) => ({ id: newId("kw"), term, enabled: true })))}>{t("set.restoreKeywords")}</Button>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("set.general")} />
            <CardBody className="space-y-3">
              <div><Label htmlFor="lang">{t("common.language")}</Label>
                <div className="flex gap-2">{(["en", "ar"] as const).map((l) => <Button key={l} variant={locale === l ? "primary" : "outline"} size="sm" onClick={() => { setLocale(l); void saveSettings({ locale: l }); }}>{l === "en" ? "English" : "العربية"}</Button>)}</div>
              </div>
            </CardBody>
          </Card>
          {demoCount > 0 && (
            <Card>
              <CardHeader title={t("set.demo")} />
              <CardBody className="space-y-3 text-sm"><p className="text-muted-foreground">{t("set.demoBody")} ({demoCount})</p><Button variant="danger" onClick={() => setConfirmDemo(true)}>{t("set.removeDemo")}</Button></CardBody>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title={t("set.integration")} description={getProvider().label} />
        <CardBody className="space-y-4">
          <Alert tone="info">{t("set.integrationNote")}</Alert>
          <ul className="divide-y divide-border text-sm">
            {(Object.keys(caps) as (keyof typeof caps)[]).map((name) => {
              const c = caps[name];
              return (
                <li key={name} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div><div className="font-medium">{t(`set.cap.${name}` as DictKey)}</div><div className="text-muted-foreground">{t(`set.cap.reason.${name}` as DictKey)}</div></div>
                  <Badge tone={c.status === "available" ? "success" : c.status === "manual_fallback" ? "warning" : "neutral"}>{t(`set.cap.${c.status}` as DictKey)}</Badge>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Modal open={confirmDemo} onClose={() => setConfirmDemo(false)} title={t("set.removeDemo")} footer={<><Button variant="outline" onClick={() => setConfirmDemo(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => void removeDemo().then(() => { toast.success(t("set.demoRemoved")); setConfirmDemo(false); })}>{t("common.delete")}</Button></>}>
        <p>{t("set.demoBody")}</p>
      </Modal>
    </>
  );
}
