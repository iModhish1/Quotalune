import { useMemo } from "react";
import { useLocale } from "./useLocale";
import type { LocaleKey } from "../i18n/keys";
import type { ResetLocaleKey, ResetPresentationConfig, ResetTranslate } from "../lib/resetPresentation";
import {
  dtoToResetSettings,
  resolveRegionalLocale,
  type ResetPresentationSettingsDto,
} from "../lib/resetPresentationSettings";
import type { StageResetOptions } from "../components/orbit/stageProviders";
import { resolveIntlLocale } from "../i18n/resolveIntlLocale";

function applyTemplate(template: string, args: string[]): string {
  let result = template;
  for (const arg of args) {
    result = result.replace("{}", arg);
  }
  return result;
}

/** Settings snapshot slice this hook needs -- deliberately narrow so a
 *  caller can pass the full bridge `SettingsSnapshot` directly. */
export interface ResetStageSettingsSource {
  resetPresentation?: ResetPresentationSettingsDto;
  resetPresentationOverrides?: Record<string, ResetPresentationSettingsDto>;
}

/** Locale + translate + persisted-config bundle for `toStageProviders`'s
 *  reset formatting -- the one adapter every stage-driven surface (tray,
 *  taskbar, float bar, pop-out panel) shares so reset text is localized
 *  and configured consistently everywhere. Precedence: surface override
 *  (`surfaceId`) -> global `resetPresentation` -> the formatter's own safe
 *  defaults (countdown-only, adaptive, system timezone/clock). */
export function useResetStageOptions(
  settings?: ResetStageSettingsSource,
  surfaceId?: string,
): StageResetOptions {
  const { t, language } = useLocale();
  const uiLocale = resolveIntlLocale(language);
  const translate: ResetTranslate = useMemo(
    () => (key: ResetLocaleKey, args: string[]) => applyTemplate(t(key as LocaleKey), args),
    [t],
  );

  const dto = (surfaceId && settings?.resetPresentationOverrides?.[surfaceId]) || settings?.resetPresentation;

  return useMemo(() => {
    const { config, regionalFormat, regionalLocale } = dtoToResetSettings(dto);
    const locale = resolveRegionalLocale(regionalFormat, uiLocale, regionalLocale);
    const resolvedConfig: Partial<ResetPresentationConfig> = config;
    return { locale, translate, config: resolvedConfig };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dto` is a
    // plain-data snapshot value; comparing by reference is intentional
    // (the settings object itself changes reference on every reload).
  }, [dto, uiLocale, translate]);
}
