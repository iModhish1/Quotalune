import QuotalisSelect from "./analytics/QuotalisSelect";
import type React from "react";
import { createContext, useContext, useId } from "react";

const FieldContext = createContext<{label: string; descriptionId?: string} | null>(null);

// ── tiny reusable controls ──────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const field = useContext(FieldContext);
  const input = (
    <input
      type="checkbox"
      className="toggle"
      checked={checked}
      aria-label={ariaLabel ?? label ?? field?.label}
      aria-describedby={field?.descriptionId}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
  if (label) {
    return (
      <label className={`toggle-label ${disabled ? "toggle-label--disabled" : ""}`}>
        {input}
        <span>{label}</span>
      </label>
    );
  }
  return input;
}

export function Select({
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
  minWidth,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  minWidth?: number;
}) {
  const field = useContext(FieldContext);
  return <div style={{width:Math.max(minWidth??160,Math.min(420,Math.max(0,...options.map(o=>o.label.length))*7.5+48)),maxWidth:"100%"}}><QuotalisSelect label={ariaLabel??field?.label??options.find(o=>o.value===value)?.label??value} value={value} options={options} onChange={onChange} disabled={disabled} searchable={options.length>9}/></div>;
}

export function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const field = useContext(FieldContext);
  return (
    <input
      type="number"
      className="number-input"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel ?? field?.label}
      aria-describedby={field?.descriptionId}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return;
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

// ── field row ────────────────────────────────────────────────────────

export function Field({
  label,
  description,
  children,
  leading,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  leading?: boolean;
}) {
  const descriptionId = useId();
  return (
    <FieldContext.Provider value={{label, descriptionId: description ? descriptionId : undefined}}>
    <div className={`settings-field${leading ? " settings-field--leading" : ""}`}>
      {leading && <div className="settings-field__control">{children}</div>}
      <div className="settings-field__text">
        <span className="settings-field__label">{label}</span>
        {description && (
          <span id={descriptionId} className="settings-field__desc">{description}</span>
        )}
      </div>
      {!leading && <div className="settings-field__control">{children}</div>}
    </div>
    </FieldContext.Provider>
  );
}
