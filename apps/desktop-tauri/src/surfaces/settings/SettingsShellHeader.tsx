import type { ReactNode } from "react";

import QuotaArcMark from "../../components/QuotaArcMark";

export default function SettingsShellHeader({
  section,
  leading,
  children,
}: {
  section: string;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="settings-studio-toolbar">
      <div className="settings-shell-brand">
        {leading}
        <span className="settings-shell-brand__mark">
          <QuotaArcMark size={32} label="Quotalis" />
        </span>
        <span className="settings-shell-brand__copy">
          <span className="settings-shell-brand__name">Quotalis</span>
          <h1>{section}</h1>
        </span>
      </div>
      {children && <div className="settings-shell-actions">{children}</div>}
    </header>
  );
}
