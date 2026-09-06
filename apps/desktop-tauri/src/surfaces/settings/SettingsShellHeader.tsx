import type { ReactNode } from "react";

import QuotaArcMark from "../../components/QuotaArcMark";

export default function SettingsShellHeader({
  section,
  children,
}: {
  section: string;
  children?: ReactNode;
}) {
  return (
    <header className="settings-studio-toolbar">
      <div className="settings-shell-brand">
        <span className="settings-shell-brand__mark">
          <QuotaArcMark size={32} label="QuotaArc" />
        </span>
        <span className="settings-shell-brand__copy">
          <span className="settings-shell-brand__name">QuotaArc</span>
          <h1>{section}</h1>
        </span>
      </div>
      {children && <div className="settings-shell-actions">{children}</div>}
    </header>
  );
}
