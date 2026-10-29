"use client";

import { useEffect, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import { cn, newId, nowIso } from "@/lib/utils";
import { DEFAULT_TEMPLATE_BODY, claimsAttachment, findPlaceholders, KNOWN_PLACEHOLDERS, removeAttachmentSentence, renderTemplate, replaceTargetRole } from "@/lib/templates";

export default function TemplatesPage() {
  const { t } = useI18n();
  const { templates, settings, saveTemplate, deleteTemplate, setDefaultTemplate } = useData();
  const [activeId, setActiveId] = useState<string>(settings?.defaultTemplateId ?? templates[0]?.id ?? "");
  const active = templates.find((x) => x.id === activeId) ?? templates[0];
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("Frontend Developer");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (active) { setName(active.name); setBody(active.body); }
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !settings) return null;
  const unknown = findPlaceholders(body).filter((p) => !(KNOWN_PLACEHOLDERS as readonly string[]).includes(p));
  const preview = renderTemplate(body, { firstName: "Sara", lastName: "Ahmed", fullName: "Sara Ahmed", company: "Acme", jobTitle: "Recruiter" }).text;
  const dirty = name !== active.name || body !== active.body;

  const create = async () => {
    const now = nowIso();
    const tpl = { id: newId("tpl"), ownerId: settings.ownerId, name: `${t("tpl.new")} ${templates.length + 1}`, body: active.body, isDefault: false, createdAt: now, updatedAt: now };
    await saveTemplate(tpl);
    setActiveId(tpl.id);
  };

  const createNoAttach = async () => {
    const now = nowIso();
    const tpl = { id: newId("tpl"), ownerId: settings.ownerId, name: `${active.name} (no attachment)`.slice(0, 120), body: removeAttachmentSentence(active.body), isDefault: false, createdAt: now, updatedAt: now };
    await saveTemplate(tpl);
    setActiveId(tpl.id);
    toast.success(t("tpl.noAttachDone"));
  };

  return (
    <>
      <PageHeader title={t("tpl.title")} description={t("tpl.subtitle")} actions={<Button onClick={() => void create()}><Plus className="size-4" />{t("tpl.new")}</Button>} />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <Card className="h-fit">
          <ul className="divide-y divide-border">
            {templates.map((x) => (
              <li key={x.id}>
                <button onClick={() => setActiveId(x.id)} className={cn("flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-sm hover:bg-muted", x.id === active.id && "bg-primary/10")}>
                  <span className="truncate">{x.name}</span>{x.id === settings.defaultTemplateId && <Badge tone="info">{t("tpl.default")}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={active.name} action={
              <div className="flex gap-2">
                {active.id !== settings.defaultTemplateId && <Button size="sm" variant="outline" onClick={() => void setDefaultTemplate(active.id).then(() => toast.success(t("common.saved")))}><Star className="size-4" />{t("tpl.setDefault")}</Button>}
                <Button size="sm" variant="ghost" onClick={() => void deleteTemplate(active.id).then(() => toast.success(t("tpl.deleted"))).catch(() => toast.error(t("tpl.lastOne")))}><Trash2 className="size-4" />{t("common.delete")}</Button>
              </div>
            } />
            <CardBody className="space-y-3">
              <div><Label htmlFor="tname">{t("tpl.name")}</Label><Input id="tname" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="tbody">{t("tpl.body")}</Label><Textarea id="tbody" rows={16} dir="auto" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} /></div>
              {unknown.length > 0 && <Alert tone="danger">{t("warn.unresolved_placeholder")} ({unknown.map((u) => `{{${u}}}`).join(", ")})</Alert>}
              {claimsAttachment(body) && <Alert tone="info">{t("tpl.attachWarn")}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!dirty || !name.trim() || !body.trim() || unknown.length > 0} onClick={() => void saveTemplate({ ...active, name: name.trim(), body }).then(() => toast.success(t("common.saved")))}>{t("common.save")}</Button>
                <Button variant="ghost" onClick={() => setBody(DEFAULT_TEMPLATE_BODY)}>{t("tpl.reset")}</Button>
                <Button variant="outline" onClick={() => void createNoAttach()}>{t("tpl.noAttach")}</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("tpl.role")} />
            <CardBody className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div><Label htmlFor="rfrom">{t("tpl.roleFrom")}</Label><Input id="rfrom" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label htmlFor="rto">{t("tpl.roleTo")}</Label><Input id="rto" value={to} placeholder="React Developer" onChange={(e) => setTo(e.target.value)} /></div>
              <Button variant="outline" disabled={!from.trim() || !to.trim()} onClick={() => setBody((b) => replaceTargetRole(b, from, to))}>{t("tpl.roleApply")}</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("tpl.preview")} />
            <CardBody><pre className="whitespace-pre-wrap text-sm leading-relaxed" dir="auto">{preview}</pre></CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
