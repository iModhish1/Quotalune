import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { QuotalisAsyncState, QuotalisSkeleton } from "../../../design-system/QuotalisLoadingStates";
import { renderProviderTrayPreview, type TrayPreview } from "../../../lib/trayQa";
import type { ProviderTrayConfig } from "../../../types/bridge";

/**
 * The tray icon exactly as the native renderer draws it: pixels come from the
 * same Rust function that feeds the Windows notification area, so style,
 * identity mark, accent, Used/Remaining and unavailable treatment cannot drift.
 * `revision` re-renders when the underlying reading or appearance changes.
 */
export function TrayNativePreview({ providerId, config, revision }: { providerId: string; config: ProviderTrayConfig; revision: string }) {
  const { t } = useLocale();
  const darkPlate = useRef<HTMLCanvasElement>(null);
  const lightPlate = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<TrayPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    let current = true;
    setFailed(false);
    renderProviderTrayPreview(providerId, JSON.parse(configKey) as ProviderTrayConfig)
      .then((next) => {
        if (current) setPreview(next);
      })
      .catch(() => {
        if (current) {
          setPreview(null);
          setFailed(true);
        }
      });
    return () => {
      current = false;
    };
  }, [providerId, configKey, revision]);

  useEffect(() => {
    if (!preview || preview.rgba.length !== preview.width * preview.height * 4) return;
    for (const plate of [darkPlate.current, lightPlate.current]) {
      plate
        ?.getContext("2d")
        ?.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba), preview.width, preview.height), 0, 0);
    }
  }, [preview]);

  if (failed) return <QuotalisAsyncState status="unavailable" />;
  if (!preview) {
    return (
      <div className="tray-native-preview" role="status" aria-label={t("TrayStudioRendering")}>
        <QuotalisSkeleton rows={1} />
      </div>
    );
  }
  return (
    <figure className="tray-native-preview" data-provider={providerId} data-style={config.style}>
      <div className="tray-native-preview__plates">
        <canvas ref={darkPlate} className="tray-native-preview__plate--dark" width={preview.width} height={preview.height} role="img" aria-label={preview.tooltip} />
        <canvas ref={lightPlate} className="tray-native-preview__plate--light" width={preview.width} height={preview.height} aria-hidden="true" />
      </div>
      <figcaption>{t("TrayStudioRendered")}</figcaption>
      <div className="tray-native-preview__tooltip">
        <span>{t("TrayStudioTooltip")}</span>
        <pre dir="auto" data-testid="tray-tooltip-preview">{preview.tooltip}</pre>
      </div>
    </figure>
  );
}
