"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Card, CardBody, CardHeader, PageHeader, Select } from "@/components/ui";
import { FIELD_KEYS, type ColumnMapping, type FieldKey } from "@/lib/csv/columns";
import { buildImportPlan } from "@/lib/csv/import-plan";
import { normalizeRows, parseCsvText, type ParsedCsv } from "@/lib/csv/parse";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import { nowIso } from "@/lib/utils";

export default function ImportPage() {
  const { t } = useI18n();
  const { contacts, settings, applyImport } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setParsed(null);
    setFileName("");
    setMapping({});
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setFileError("import.err.not_csv");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("import.err.file_too_large");
      return;
    }
    const text = await file.text();
    const result = parseCsvText(text);
    setFileName(file.name);
    setParsed(result);
    setMapping(result.suggestedMapping);
  };

  const rows = useMemo(() => (parsed ? normalizeRows(parsed.rows, mapping) : []), [parsed, mapping]);
  const now = useMemo(() => nowIso(), [parsed]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => {
    if (!parsed || !settings) return null;
    const ownerId = settings.ownerId;
    return buildImportPlan(rows, contacts.filter((c) => !c.isDemo), ownerId, settings.keywords, { type: "linkedin_csv", fileName, importedAt: now }, now);
  }, [parsed, rows, contacts, settings, fileName, now]);

  const hasNameMapping = Boolean(mapping.fullName || mapping.firstName);
  const total = plan ? plan.toCreate.length + plan.toUpdate.length : 0;

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await applyImport(plan, fileName);
      toast.success(t("import.done", { n: plan.toCreate.length, u: plan.toUpdate.length }));
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const problems = rows.filter((r) => r.issues.length).slice(0, 8);

  return (
    <>
      <PageHeader title={t("import.title")} description={t("import.subtitle")} />
      {!parsed && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardBody>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]); }}
                className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <FileUp className="size-8 text-muted-foreground" aria-hidden />
                <input ref={inputRef} id="csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} />
                <Button onClick={() => inputRef.current?.click()}>{t("import.choose")}</Button>
                <p className="text-sm text-muted-foreground">{t("import.drop")}</p>
              </div>
              {fileError && <Alert tone="danger" className="mt-3">{t(fileError as DictKey)}</Alert>}
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title={t("import.howTitle")} />
            <CardBody className="space-y-2 text-sm">
              <ol className="list-decimal space-y-1 ps-5">
                <li>{t("import.how1")}</li><li>{t("import.how2")}</li><li>{t("import.how3")}</li>
              </ol>
              <Alert tone="info">{t("import.limit")}</Alert>
            </CardBody>
          </Card>
        </div>
      )}

      {parsed && (
        <div className="space-y-6">
          {parsed.errors.map((code) => <Alert key={code} tone={code === "malformed_quotes" ? "warning" : code === "header_not_recognized" ? "warning" : "danger"}>{t(`import.err.${code}` as DictKey)}</Alert>)}

          <Card>
            <CardHeader title={t("import.mapping")} description={`${t("import.file")}: ${fileName} · ${parsed.rows.length}`} action={<Button variant="outline" size="sm" onClick={reset}>{t("import.reset")}</Button>} />
            <CardBody>
              <p className="mb-3 text-sm text-muted-foreground">{t("import.mappingHint")}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FIELD_KEYS.map((key: FieldKey) => (
                  <label key={key} className="text-sm">
                    <span className="mb-1 block font-medium">{t(`field.${key}` as DictKey)}</span>
                    <Select value={mapping[key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}>
                      <option value="">{t("import.notMapped")}</option>
                      {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </label>
                ))}
              </div>
              {!hasNameMapping && <Alert tone="danger" className="mt-3">{t("issue.missing_name")}: {t("field.firstName")} / {t("field.fullName")}</Alert>}
            </CardBody>
          </Card>

          {plan && hasNameMapping && (
            <Card>
              <CardHeader title={t("import.preview")} />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    [t("import.newContacts"), plan.toCreate.length, "success"],
                    [t("import.updated"), plan.toUpdate.length, "info"],
                    [t("import.unchanged"), plan.unchanged, "neutral"],
                    [t("import.duplicates"), plan.duplicatesInFile, "warning"],
                    [t("import.invalid"), plan.invalid.length, "danger"],
                  ].map(([label, n, tone]) => (
                    <div key={label as string} className="rounded-lg border border-border p-3">
                      <div className="text-2xl font-semibold tabular-nums">{n as number}</div>
                      <Badge tone={tone as "success"} className="mt-1 whitespace-normal">{label as string}</Badge>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-start text-xs uppercase text-muted-foreground">
                      <tr>{["common.name", "common.jobTitle", "common.company", "common.profileUrl"].map((k) => <th key={k} className="px-3 py-2 text-start">{t(k as DictKey)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {plan.toCreate.slice(0, 8).map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="px-3 py-2">{c.fullName}</td><td className="px-3 py-2">{c.jobTitle || t("common.none")}</td>
                          <td className="px-3 py-2">{c.company || t("common.none")}</td><td className="max-w-[16rem] truncate px-3 py-2" dir="ltr">{c.linkedInProfileUrl || t("common.none")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {problems.length > 0 && (
                  <Alert tone="warning">
                    <div className="font-medium">{t("import.problems")}</div>
                    <ul className="mt-1 list-disc ps-5">
                      {problems.map((r) => <li key={r.rowNumber}>{t("import.row")} {r.rowNumber}: {r.issues.map((i) => t(`issue.${i}` as DictKey)).join(", ")}</li>)}
                    </ul>
                  </Alert>
                )}
                <div className="flex items-center gap-3">
                  <Button disabled={busy || total === 0} onClick={() => void confirm()}>{busy ? t("import.importing") : t("import.confirm", { n: total })}</Button>
                  {total === 0 && <span className="text-sm text-muted-foreground">{t("import.nothing")}</span>}
                  <Link href="/contacts" className="text-sm text-primary hover:underline">{t("nav.contacts")}</Link>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
