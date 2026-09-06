export const LOGO_APPEARANCE_STORAGE_KEY = "quotaarc.logo-appearance.v1";

export const LOGO_VARIANTS = ["silver", "arctic", "aurora", "ember", "violet"] as const;
export type LogoVariant = (typeof LOGO_VARIANTS)[number];

export const LOGO_SIZES = ["compact", "balanced", "prominent"] as const;
export type LogoSize = (typeof LOGO_SIZES)[number];

export interface LogoAppearance {
  variant: LogoVariant;
  size: LogoSize;
}

const DEFAULT_LOGO_APPEARANCE: LogoAppearance = {
  variant: "silver",
  size: "prominent",
};

const subscribers = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedAppearance: LogoAppearance = DEFAULT_LOGO_APPEARANCE;

function isLogoVariant(value: unknown): value is LogoVariant {
  return typeof value === "string" && (LOGO_VARIANTS as readonly string[]).includes(value);
}

function isLogoSize(value: unknown): value is LogoSize {
  return typeof value === "string" && (LOGO_SIZES as readonly string[]).includes(value);
}

export function readLogoAppearance(): LogoAppearance {
  try {
    const raw = localStorage.getItem(LOGO_APPEARANCE_STORAGE_KEY);
    if (raw === cachedRaw) return cachedAppearance;
    cachedRaw = raw;
    if (!raw) {
      cachedAppearance = DEFAULT_LOGO_APPEARANCE;
      return cachedAppearance;
    }
    const parsed = JSON.parse(raw) as Partial<LogoAppearance>;
    cachedAppearance = {
      variant: isLogoVariant(parsed.variant) ? parsed.variant : DEFAULT_LOGO_APPEARANCE.variant,
      size: isLogoSize(parsed.size) ? parsed.size : DEFAULT_LOGO_APPEARANCE.size,
    };
    return cachedAppearance;
  } catch {
    cachedRaw = undefined;
    cachedAppearance = DEFAULT_LOGO_APPEARANCE;
    return cachedAppearance;
  }
}

export function writeLogoAppearance(next: LogoAppearance): void {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(LOGO_APPEARANCE_STORAGE_KEY, raw);
  } catch {
    // The canonical Rust setting still persists the choice. Keep the current
    // webview responsive when storage is disabled by policy.
  }
  cachedRaw = raw;
  cachedAppearance = next;
  subscribers.forEach((subscriber) => subscriber());
  window.dispatchEvent(new CustomEvent("quotaarc:logo-appearance", { detail: next }));
}

export function subscribeLogoAppearance(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LOGO_APPEARANCE_STORAGE_KEY) subscriber();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(subscriber);
    window.removeEventListener("storage", onStorage);
  };
}

export function logoScale(size: LogoSize): number {
  return size === "compact" ? 0.9 : size === "balanced" ? 1 : 1.16;
}

export function logoSizePercent(size: LogoSize): number {
  return Math.round(logoScale(size) * 100);
}

export function logoSizeFromPercent(percent: number | undefined): LogoSize {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return DEFAULT_LOGO_APPEARANCE.size;
  return percent < 96 ? "compact" : percent < 108 ? "balanced" : "prominent";
}

export function syncLogoAppearance(next: LogoAppearance): void {
  const current = readLogoAppearance();
  if (current.variant === next.variant && current.size === next.size) return;
  writeLogoAppearance(next);
}
