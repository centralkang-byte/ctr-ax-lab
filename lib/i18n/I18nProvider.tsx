"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, INTL_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from "./config";
import { messages } from "./dictionary";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Translate a dot-path key, e.g. t("nav.home"). Falls back to KR, then the key itself. */
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(locale: Locale, key: string): string | undefined {
  const [ns, leaf] = key.split(".");
  if (!ns || !leaf) return undefined;
  return messages[locale]?.[ns]?.[leaf];
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage on mount (client-only; default KR for SSR).
  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) setLocaleState(stored);
  }, []);

  // Persist + reflect on <html lang>.
  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = INTL_LOCALE[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const t = useCallback(
    (key: string) => lookup(locale, key) ?? lookup(DEFAULT_LOCALE, key) ?? key,
    [locale]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so components don't crash if rendered outside the provider.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string) => lookup(DEFAULT_LOCALE, key) ?? key
    };
  }
  return ctx;
}
