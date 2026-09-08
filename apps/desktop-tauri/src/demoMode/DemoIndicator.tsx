/**
 * The one persistent, tasteful "this data is simulated" indicator (owner
 * Phase 5.2 section 1/27) -- reused by every visualization surface Demo
 * Mode affects (2D Dashboard, 3D scene) rather than each surface
 * inventing its own wording. Screen-reader understandable via `role`
 * (owner section 48) -- never relies on color alone.
 */
import { useLocale } from "../hooks/useLocale";
import "./DemoIndicator.css";

export interface DemoIndicatorProps {
  providerCount: number;
  onExit: () => void;
}

export default function DemoIndicator({ providerCount, onExit }: DemoIndicatorProps) {
  const { t } = useLocale();
  return (
    <div className="demo-indicator" role="status">
      <span className="demo-indicator__badge">{t("DemoIndicatorBadge")}</span>
      <span className="demo-indicator__detail">
        {t("DemoIndicatorDetail").replace("{}", String(providerCount))}
      </span>
      <button type="button" className="demo-indicator__exit" onClick={onExit}>
        {t("DemoIndicatorExit")}
      </button>
    </div>
  );
}
