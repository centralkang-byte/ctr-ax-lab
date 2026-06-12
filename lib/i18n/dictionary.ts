import type { Locale } from "./config";

// Nested message catalog. CTR AX Lab is a single-purpose evaluator, so the
// chrome strings live here; the evaluation page carries its own copy.
export type Messages = typeof messages.kr;

export const messages: Record<Locale, Record<string, Record<string, string>>> = {
  kr: {
    nav: {
      evaluate: "AX 과제"
    },
    settings: {
      language: "언어",
      langKr: "한국어",
      langEn: "English"
    }
  },
  en: {
    nav: {
      evaluate: "AX Projects"
    },
    settings: {
      language: "Language",
      langKr: "한국어",
      langEn: "English"
    }
  }
};
