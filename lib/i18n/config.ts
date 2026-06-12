// Lightweight i18n config — KR default, EN toggle.
export type Locale = "kr" | "en";

export const LOCALES: Locale[] = ["kr", "en"];
export const DEFAULT_LOCALE: Locale = "kr";
export const LOCALE_STORAGE_KEY = "execution_os_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "kr" || value === "en";
}

// Intl locale tags for date/number formatting.
export const INTL_LOCALE: Record<Locale, string> = {
  kr: "ko-KR",
  en: "en-US"
};
