"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar, en, type DictKey } from "./i18n-dict";

export type Locale = "en" | "ar";
interface I18n {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale(l: Locale): void;
  t(key: DictKey, vars?: Record<string, string | number>): string;
  /** Translate a dynamic key that may not exist; falls back to the raw value. */
  tx(key: string, fallback?: string): string;
}

const Ctx = createContext<I18n | null>(null);
const STORAGE_KEY = "lho-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict: Record<string, string> = locale === "ar" ? ar : en;
    const interpolate = (s: string, vars?: Record<string, string | number>) =>
      vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
    return {
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      t: (key, vars) => interpolate(dict[key] ?? key, vars),
      tx: (key, fallback) => dict[key] ?? fallback ?? key,
    };
  }, [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
