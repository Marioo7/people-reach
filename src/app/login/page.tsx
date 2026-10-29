"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Languages } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Alert, Button, Card, CardBody, Input, Label } from "@/components/ui";
import { Logo } from "@/components/logo";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) });
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, loading, demo, signIn, signUp, signInGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try { await fn(); } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setLocale(locale === "en" ? "ar" : "en")}><Languages className="size-4" />{locale === "en" ? "العربية" : "English"}</Button>
        </div>
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-semibold"><Logo className="size-10" />{t("app.name")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>
            </div>
            {demo ? (
              <Alert tone="warning">{t("demo.banner")}</Alert>
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit((v) => run(() => (mode === "in" ? signIn(v.email, v.password) : signUp(v.email, v.password))))} noValidate>
                <div>
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" type="email" autoComplete="email" dir="ltr" aria-invalid={!!errors.email} {...register("email")} />
                </div>
                <div>
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input id="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} dir="ltr" aria-invalid={!!errors.password} {...register("password")} />
                </div>
                {(error || errors.email || errors.password) && <Alert tone="danger">{t("auth.error")}</Alert>}
                <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? t("auth.signIn") : t("auth.signUp")}</Button>
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => void run(signInGoogle)}>{t("auth.google")}</Button>
                <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? t("auth.noAccount") : t("auth.haveAccount")}</button>
              </form>
            )}
            {demo && <Button className="w-full" onClick={() => router.replace("/")}>{t("nav.dashboard")}</Button>}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
