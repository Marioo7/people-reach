"use client";

import { useRef, useState } from "react";
import { Download, FileText, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Modal, PageHeader } from "@/components/ui";
import { CvError, downloadCv } from "@/lib/cv-client";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";

export default function CvPage() {
  const { t, locale } = useI18n();
  const { demo, user } = useAuth();
  const { selectedCv, uploadCv, removeCv } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setErrors([]);
    setBusy(true);
    try {
      await uploadCv(file);
      toast.success(t("cv.uploaded"));
    } catch (e) {
      setErrors(e instanceof CvError ? (e.codes as string[]) : ["generic"]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const errText = (c: string) => (c === "generic" || c === "upload_failed" ? t("common.errorGeneric") : t(`cv.err.${c}` as DictKey));

  return (
    <>
      <PageHeader title={t("cv.title")} description={t("cv.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("cv.current")} />
          <CardBody className="space-y-4">
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={t("cv.upload")} onChange={(e) => void onFile(e.target.files?.[0])} />
            {selectedCv ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3"><FileText className="size-8 text-primary" aria-hidden />
                  <div><div className="font-medium" dir="auto">{selectedCv.fileName}</div>
                    <div className="text-xs text-muted-foreground">{t("cv.size", { n: Math.max(1, Math.round(selectedCv.sizeBytes / 1024)) })} · {new Date(selectedCv.updatedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB")}</div></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void downloadCv({ demo, ownerId: user?.uid ?? "", cv: selectedCv }).catch((e) => toast.error(e instanceof CvError ? t(`cv.err.${e.codes[0]}` as DictKey) : t("common.errorGeneric")))}><Download className="size-4" />{t("cv.download")}</Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="size-4" />{t("cv.replace")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />{t("common.delete")}</Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={<FileText className="size-6" />} title={t("cv.none")} body={t("cv.rules")} action={<Button disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="size-4" />{t("cv.upload")}</Button>} />
            )}
            {errors.map((c) => <Alert key={c} tone="danger">{errText(c)}</Alert>)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" />{t("cv.rules")}</span>} />
          <CardBody className="space-y-3 text-sm text-muted-foreground">
            <p>{demo ? t("demo.banner") : t("cv.subtitle")}</p>
            <Alert tone="info">{t("cv.manual")}</Alert>
          </CardBody>
        </Card>
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("common.delete")} footer={<><Button variant="outline" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => selectedCv && void removeCv(selectedCv).then(() => { toast.success(t("cv.deleted")); setConfirmDelete(false); })}>{t("common.delete")}</Button></>}>
        <p>{selectedCv?.fileName}</p>
      </Modal>
    </>
  );
}
