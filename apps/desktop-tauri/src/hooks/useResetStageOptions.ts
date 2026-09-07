import { useMemo } from "react";
import { useLocale } from "./useLocale";
import type { LocaleKey } from "../i18n/keys";
import type { ResetLocaleKey, ResetTranslate } from "../lib/resetPresentation";
import type { Language } from "../types/bridge";
import type { StageResetOptions } from "../components/orbit/stageProviders";

/** Same BCP-47 tags `localeDirection.ts` applies to the document -- reused
 *  here so the UI language and the Intl locale used for reset formatting
 *  never drift apart. */
const LANGUAGE_TAGS: Record<Language, string> = {
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

function applyTemplate(template: string, args: string[]): string {
  let result = template;
  for (const arg of args) {
    result = result.replace("{}", arg);
  }
  return result;
}

/** Locale + translate bundle for `toStageProviders`'s reset formatting,
 *  backed by the active app locale -- the one adapter every stage-driven
 *  surface (tray, taskbar, float bar, pop-out panel) shares so reset text
 *  is localized consistently everywhere. */
export function useResetStageOptions(): StageResetOptions {
  const { t, language } = useLocale();
  const locale = LANGUAGE_TAGS[language];
  const translate: ResetTranslate = useMemo(
    () => (key: ResetLocaleKey, args: string[]) => applyTemplate(t(key as LocaleKey), args),
    [t],
  );
  return useMemo(() => ({ locale, translate }), [locale, translate]);
}
