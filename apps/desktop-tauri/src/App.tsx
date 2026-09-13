import { WorkspacePresentation } from "./design-system/WorkspacePresentation";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  checkForUpdates,
  downloadUpdate,
  getBootstrapState,
  getSettingsSnapshot,
  setSurfaceMode,
} from "./lib/tauri";
import { useSurfaceSnapshot } from "./hooks/useSurfaceSnapshot";
import { resolveThemePreference, useTheme } from "./hooks/useTheme";
import { useLocale } from "./hooks/useLocale";
import TrayPanel from "./surfaces/TrayPanel";
import { FLOATBAR_WINDOW_LABEL } from "./floatbar/api";
import { LocaleProvider, PreviewLocaleProvider } from "./i18n/LocaleProvider";
import type { BootstrapState, ThemePreference } from "./types/bridge";
import type { SurfaceSnapshot } from "./hooks/useSurfaceSnapshot";
import { useDeepSeekPricingStatus } from "./hooks/useDeepSeekPricingStatus";
import { DesignSystemProvider } from "./design-system";
import { logoSizeFromPercent, syncLogoAppearance } from "./design-system/logoAppearance";

/**
 * Applies the QuotaArc design-system theme/motion context to a surface
 * window. Surfaces render dark-canonical glass; motion follows the system
 * preference unless the user narrows it in settings later.
 */
function DesignSystemBridge({ children }: { children: React.ReactNode }) {
  return <DesignSystemProvider theme="dark" motionSetting="auto">{children}</DesignSystemProvider>;
}

const Settings = lazy(() => import("./surfaces/Settings"));
const PopOutPanel = lazy(() => import("./surfaces/PopOutPanel"));
const FloatBar = lazy(() => import("./floatbar/FloatBar"));
const TopArc = lazy(() => import("./surfaces/top-arc/TopArc"));
const CollectionsNativeView = lazy(() => import("./surfaces/collections/CollectionsNativeView"));
const DemoStage = lazy(() => import("./demo/DemoStage"));

function SurfaceFallback() {
  return null;
}

/** True when running inside the detached Settings window. */
function isSettingsWindow(): boolean {
  return getCurrentWebviewWindow().label === "settings";
}

/** True when running inside the detached FloatBar window. */
function isFloatBarWindow(): boolean {
  return getCurrentWebviewWindow().label === FLOATBAR_WINDOW_LABEL;
}

/** True when running inside the detached Top Arc surface window. */
function isTopArcWindow(): boolean {
  // The native label is authoritative. The URL fallback protects the
  // dedicated transparent webview on older WebView2 builds that transiently
  // report the shared `main` label while the window is being created.
  return getCurrentWebviewWindow().label === "top-arc"
    || new URLSearchParams(window.location.search).get("window") === "top-arc";
}

/** True when running inside the detached Collections window. */
function isCollectionsWindow(): boolean {
  return getCurrentWebviewWindow().label === "collections";
}

/** True when running inside the detached flyout ("Pop Out Dashboard") window. */
function isFlyoutWindow(): boolean {
  return getCurrentWebviewWindow().label === "flyout";
}

/** Parse the initial Settings tab from the URL query string. */
function initialSettingsTab(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "general";
}

export default function App() {
  // Demo stage: pure render, no Tauri APIs (headless screenshot gate).
  if (new URLSearchParams(window.location.search).get("window") === "demo") {
    return (
      <PreviewLocaleProvider>
        <Suspense fallback={<SurfaceFallback />}>
          <DemoStage />
        </Suspense>
      </PreviewLocaleProvider>
    );
  }
  return (
    <LocaleProvider>
      <AppInner />
    </LocaleProvider>
  );
}

function AppInner() {
  const { t } = useLocale();
  const surface = useSurfaceSnapshot();
  const [state, setState] = useState<BootstrapState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("dark");

  useTheme(themePreference);
  useDeepSeekPricingStatus();

  const reloadBootstrapState = useCallback(
    () => getBootstrapState(),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    reloadBootstrapState()
      .then((bootstrap) => {
        if (cancelled) {
          return;
        }
        setState(bootstrap);
        setThemePreference(resolveThemePreference(bootstrap.settings));
        syncLogoAppearance({
          variant: bootstrap.settings.logoVariant ?? "silver",
          size: logoSizeFromPercent(bootstrap.settings.logoScalePercent),
        });
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    // Fire-and-forget update checks after the first paint so startup/tray open
    // is not competing with network work.
    const updateTimer = window.setTimeout(() => {
      Promise.all([checkForUpdates(), getSettingsSnapshot()])
        .then(([update, settings]) => {
          if (settings.autoDownloadUpdates && update.canDownload) {
            void downloadUpdate().catch(() => {});
          }
        })
        .catch(() => {});
    }, 2_000);

    // Listen for user-registered global shortcut events from the
    // `register_global_shortcut` command. The persistent shortcut (bound via
    // shortcut_bridge::plugin) already opens the PopOut dashboard natively;
    // this listener is the fallback for ad-hoc capture-mode registrations.
    const unlistenPromise = listen<string>("global-shortcut-triggered", () => {
      void setSurfaceMode("popOut", { kind: "dashboard" }).catch(() => {});
    });

    const unlistenSettingsChangePromise = isSettingsWindow()
      ? listen<string>("settings-change-tab", () => {
          void reloadBootstrapState()
            .then((bootstrap) => {
              setState(bootstrap);
              setThemePreference(resolveThemePreference(bootstrap.settings));
              syncLogoAppearance({
                variant: bootstrap.settings.logoVariant ?? "silver",
                size: logoSizeFromPercent(bootstrap.settings.logoScalePercent),
              });
              setError(null);
            })
            .catch(() => {});
        })
      : Promise.resolve(null);

    const refreshThemeAndLogo = (settings: BootstrapState["settings"]) => {
      setThemePreference(resolveThemePreference(settings));
      syncLogoAppearance({
        variant: settings.logoVariant ?? "silver",
        size: logoSizeFromPercent(settings.logoScalePercent),
      });
    };

    // Keep the theme in sync when mutations happen inside other surfaces
    // (e.g., Settings → Appearance). `useSettings` dispatches this event
    // after every successful `updateSettings` call made by ITS OWN webview.
    const onSettingsUpdated = (evt: Event) => {
      const detail = (evt as CustomEvent<BootstrapState["settings"]>).detail;
      if (detail) {
        refreshThemeAndLogo(detail);
      } else {
        getSettingsSnapshot().then(refreshThemeAndLogo).catch(() => {});
      }
    };
    window.addEventListener("quotalis:settings-updated", onSettingsUpdated);

    // The listener above is a same-webview DOM CustomEvent -- it never fires
    // for a change made in ANOTHER window (the detached Settings window and
    // the main window are separate webviews with separate React state), nor
    // for a change made through any path other than `useSettings().update()`
    // itself (e.g. set_catalog_theme/set_global_limit_presentation/
    // set_reset_presentation, which persist real settings but don't dispatch
    // this window's local CustomEvent). Also listen to Rust's own real
    // cross-window broadcasts so theme/logo genuinely live-sync regardless
    // of which window or command changed them -- the same events
    // hooks/useSettings.ts already listens to for its own state.
    const unlistenCrossWindowPromises = ["settings-changed", "quotalis:settings-updated"].map(
      (eventName) =>
        listen(eventName, () => {
          getSettingsSnapshot().then(refreshThemeAndLogo).catch(() => {});
        }),
    );

    return () => {
      cancelled = true;
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      void unlistenSettingsChangePromise
        .then((unlisten) => unlisten?.())
        .catch(() => {});
      unlistenCrossWindowPromises.forEach((p) =>
        void p.then((unlisten) => unlisten()).catch(() => {}),
      );
      window.clearTimeout(updateTimer);
      window.removeEventListener("quotalis:settings-updated", onSettingsUpdated);
    };
  }, [reloadBootstrapState]);

  if (error) {
    return (
      <main className="shell">
        <section className="panel error">
          <h2>{t("BootstrapFailed")}</h2>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="shell">
        <section className="panel">
          <h2>{t("LoadingShellContract")}</h2>
          <p>{t("LoadingShellContractHint")}</p>
        </section>
      </main>
    );
  }

  return <WorkspacePresentation initial={state.settings}><AppSurfaces state={state} surface={surface}/></WorkspacePresentation>;
}

function AppSurfaces({state, surface}: {state: BootstrapState; surface: SurfaceSnapshot}) {
  // Detached settings window — render Settings directly, skip SurfaceRouter.
  if (isSettingsWindow()) {
    return <DetachedSettingsApp state={state} />;
  }

  // Detached floating-bar window — render the FloatBar surface directly.
  if (isFloatBarWindow()) {
    return (
      <Suspense fallback={<SurfaceFallback />}>
        <FloatBar state={state} />
      </Suspense>
    );
  }

  // QuotaArc Surface Engine windows — self-contained provider-data surfaces.
  if (isTopArcWindow()) {
    return (
      <Suspense fallback={<SurfaceFallback />}>
        <DesignSystemBridge>
          <TopArc />
        </DesignSystemBridge>
      </Suspense>
    );
  }
  // Detached flyout ("Pop Out Dashboard") window — render TrayPanel directly.
  // TrayPanel is statically imported (not lazy), so no Suspense boundary is
  // needed here, unlike the other detached-window branches above.
  if (isFlyoutWindow()) {
    return <TrayPanel state={state} />;
  }

  // Detached Collections window — the live, native rendering of a saved
  // collection_layout (see CollectionsNativeView).
  if (isCollectionsWindow()) {
    return (
      <Suspense fallback={<SurfaceFallback />}>
        <CollectionsNativeView />
      </Suspense>
    );
  }

  return <SurfaceRouter surface={surface} state={state} />;
}

function SurfaceRouter({
  surface,
  state,
}: {
  surface: SurfaceSnapshot;
  state: BootstrapState;
}) {
  switch (surface.mode) {
    case "hidden":
      return null;
    case "trayPanel":
      return <TrayPanel state={state} />;
    case "popOut": {
      const providerId =
        surface.target.kind === "provider"
          ? surface.target.providerId
          : undefined;
      return (
        <Suspense fallback={<SurfaceFallback />}>
          <PopOutPanel state={state} providerId={providerId} />
        </Suspense>
      );
    }
    case "settings":
      return (
        <Suspense fallback={<SurfaceFallback />}>
          <SettingsLayout state={state} />
        </Suspense>
      );
    default:
      return <TrayPanel state={state} />;
  }
}

function SettingsLayout({ state }: { state: BootstrapState }) {
  return (
    <main className="settings-surface settings-surface--full">
      <Settings state={state} />
    </main>
  );
}

function DetachedSettingsApp({ state }: { state: BootstrapState }) {
  const [tab, setTab] = useState(initialSettingsTab);
  const [tabRevision,setTabRevision]=useState(0);

  useEffect(() => {
    // Listen for tab-change events from Rust (when the window is re-focused
    // with a different tab request).
    const unlisten = listen<string>("settings-change-tab", (event) => {
      setTab(event.payload);
      setTabRevision(value=>value+1);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <Suspense fallback={<SurfaceFallback />}>
      <main className="settings-surface settings-surface--full">
        <Settings state={state} initialTab={tab} navigationRevision={tabRevision} />
      </main>
    </Suspense>
  );
}
