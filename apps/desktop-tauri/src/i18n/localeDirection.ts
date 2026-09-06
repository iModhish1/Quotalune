import type { Language } from "../types/bridge";

export type LocaleDocumentMetadata = {
  lang: string;
  dir: "ltr" | "rtl";
};

const LANGUAGE_TAGS: Record<Language, string> = {
  english: "en",
  chinese: "zh-Hans",
  chinesetraditional: "zh-Hant",
  japanese: "ja",
  korean: "ko",
  spanish: "es-MX",
  russian: "ru",
  turkish: "tr",
  arabic: "ar",
};

export function localeDocumentMetadata(language: Language): LocaleDocumentMetadata {
  return {
    lang: LANGUAGE_TAGS[language],
    dir: language === "arabic" ? "rtl" : "ltr",
  };
}

export function applyLocaleDocumentMetadata(language: Language): void {
  const metadata = localeDocumentMetadata(language);
  document.documentElement.lang = metadata.lang;
  document.documentElement.dir = metadata.dir;
}
