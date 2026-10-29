"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, FileText, History, LayoutDashboard, Languages, LogOut, Menu, Moon, Send, Settings, Sun, Upload, UserSearch, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DataProvider, useData } from "@/lib/data/data-context";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import { cn } from "@/lib/utils";
import { Alert, Button, Skeleton } from "@/components/ui";
import { Logo } from "@/components/logo";

const NAV: { href: string; key: DictKey; icon: typeof BarChart3 }[] = [
  { href: "/", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/import", key: "nav.import", icon: Upload },
  { href: "/contacts", key: "nav.contacts", icon: Users },
  { href: "/recruiters", key: "nav.recruiters", icon: UserSearch },
  { href: "/review", key: "nav.review", icon: Send },
  { href: "/templates", key: "nav.templates", icon: FileText },
  { href: "/cv", key: "nav.cv", icon: FileText },
  { href: "/history", key: "nav.history", icon: History },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

function ThemeToggle() {
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("lho-theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return (
    <Button variant="ghost" size="sm" aria-label={t("common.theme")} onClick={() => {
      const next = !dark;
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("lho-theme", next ? "dark" : "light");
    }}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const { user, demo, signOut } = useAuth();
  const { loading, error, reload } = useData();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {NAV.map(({ href, key, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-border bg-card lg:block">
        <div className="border-b border-border px-5 py-4"><div className="flex items-center gap-2 text-lg font-semibold"><Logo />{t("app.name")}</div></div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 start-0 w-64 bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-lg font-semibold"><Logo />{t("app.name")}</div>
              <button onClick={() => setOpen(false)} aria-label={t("common.close")}><X className="size-4" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card/90 px-4 py-2 backdrop-blur">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="size-4" /></Button>
          <div className="ms-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setLocale(locale === "en" ? "ar" : "en")} aria-label={t("common.language")}>
              <Languages className="size-4" /> {locale === "en" ? "العربية" : "English"}
            </Button>
            <ThemeToggle />
            <span className="hidden px-2 text-sm text-muted-foreground sm:inline">{user?.email}</span>
            {!demo && <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label={t("common.signOut")}><LogOut className="size-4" /></Button>}
          </div>
        </header>
        {demo && <div className="border-b border-warning/40 bg-warning/10 px-4 py-2 text-center text-sm">{t("demo.banner")}</div>}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          {error ? (
            <Alert tone="danger">
              <div className="flex items-center justify-between gap-3"><span>{t("common.errorGeneric")} ({error})</span><Button size="sm" variant="outline" onClick={() => void reload()}>{t("common.retry")}</Button></div>
            </Alert>
          ) : loading ? (
            <div className="space-y-4" aria-busy="true"><Skeleton className="h-8 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading || !user) return <div className="p-8" aria-busy="true"><Skeleton className="h-8 w-48" /></div>;
  return (
    <DataProvider>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
