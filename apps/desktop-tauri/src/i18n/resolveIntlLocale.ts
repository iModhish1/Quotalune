import type { Language } from "../types/bridge";

/**
 * The one BCP-47 tag table for `Intl.DateTimeFormat`/`Intl.NumberFormat`
 * calls that should track the user's selected UI language (not the
 * `dir`/`lang` document-attribute table in `i18n/localeDirection.ts`, which
 * intentionally uses shorter region-less tags for HTML `lang`). Previously
 * duplicated inline inside `useResetStageOptions.ts` with a comment
 * incorrectly claiming it matched `localeDirection.ts`'s map -- it didn't
 * (e.g. `en-US` vs `en`, `ar-SA` vs `ar`). Centralized here so every caller
 * that needs an actual region-specific Intl locale (month/day names,
 * number formatting) shares one table instead of drifting copies.
 */
const LANGUAGE_TO_INTL_LOCALE: Record<Language, string> = {
  english: "en-US",
  chinese: "zh-CN",
  chinesetraditional: "zh-TW",
  japanese: "ja-JP",
  korean: "ko-KR",
  spanish: "es-MX",
  russian: "ru-RU",
  turkish: "tr-TR",
  arabic: "ar-SA",
};

/** Resolve the current UI language to a concrete BCP-47 Intl locale tag. */
export function resolveIntlLocale(language: Language): string {
  return LANGUAGE_TO_INTL_LOCALE[language] ?? "en-US";
}
