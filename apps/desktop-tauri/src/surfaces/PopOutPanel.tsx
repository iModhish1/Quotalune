import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { BootstrapState } from "../types/bridge";
import { openFlyoutWindow, openSettingsWindow, quitApp as quitApplication } from "../lib/tauri";
import { useProviders } from "../hooks/useProviders";
import { useSettings } from "../hooks/useSettings";
import { useUpdateState } from "../hooks/useUpdateState";
import { useLocale } from "../hooks/useLocale";
import { useDashboardState } from "../hooks/useDashboardState";
import DashboardHost from "./dashboard/DashboardHost";
import DashboardBody from "../components/DashboardBody";
import PopOutTitleBar from "../components/PopOutTitleBar";
import MenuSurface, { type MenuFooterRow } from "../components/MenuSurface";
import UpdateBanner from "../components/UpdateBanner";
import {
  toStageProviders,
  usageConfigFromSnapshot,
} from "../components/orbit/stageProviders";
import { resolveCatalogTheme } from "../design-system/themeResolution";
import { useResetStageOptions } from "../hooks/useResetStageOptions";

/**
 * "Open Dashboard in Separate Window" -- the detached secondary surface.
 * The in-shell Settings "Dashboard" tab (`DashboardTab.tsx`) is the
 * first-class, default way to reach the Dashboard; this window remains as
 * an explicit, separate path (reachable via `startupDestination` and the
 * persistent global shortcut) for users who want a standalone compact
 * window. Both share the exact same content (`DashboardBody.tsx` +
 * `useDashboardState`) -- only the window chrome here (title bar, zoom
 * scaling, footer actions, keyboard shortcuts) is unique to this surface.
 */
export default function PopOutPanel({
  state,
  providerId,
}: {
  state: BootstrapState;
  providerId?: string;
}) {
  const {
    providers,
    isRefreshing,
    refreshingProviderIds,
    refresh,
    hasCachedData,
  } = useProviders();
  const { settings } = useSettings(state.settings);
  const { updateState, checkNow, download, apply, dismiss, openRelease } =
    useUpdateState();
  const { t } = useLocale();

  const {
    sorted,
    visibleProviders,
    selectedProviderId,
    gridExpanded,
    setGridExpanded,
    handleGridClick,
    handleReorder,
    setCardRef,
  } = useDashboardState({
    providers,
    bootstrapProviders: state.providers,
    settings,
    deepLinkProviderId: providerId,
  });

  const windowScale = useMemo(() => {
    const scalePercent = Number(settings.windowScalePercent);
    return (
      Math.min(250, Math.max(100, Number.isFinite(scalePercent) ? scalePercent : 100)) / 100
    );
  }, [settings.windowScalePercent]);

  // Scale the dashboard via the webview's native zoom (like a browser's Ctrl-+):
  // it reflows content at the real window width, so the side-by-side cards keep
  // filling the window at any scale — unlike CSS `zoom`, which overflows. The
  // main window is shared with the tray surface, so reset zoom to 1 on unmount.
  useEffect(() => {
    const webview = getCurrentWebviewWindow();
    void webview.setZoom(windowScale).catch(() => {});
    return () => {
      void webview.setZoom(1).catch(() => {});
    };
  }, [windowScale]);

  const [settingsLaunchError,setSettingsLaunchError]=useState<string|null>(null);
  const openSettingsTab=useCallback(async(tab:string)=>{
    setSettingsLaunchError(null);
    try { await openSettingsWindow(tab); }
    catch(error){setSettingsLaunchError(`Could not open settings: ${error instanceof Error?error.message:String(error)}`);}
  },[]);
  const openSettings = useCallback(() => { void openSettingsTab("general"); }, [openSettingsTab]);
  const goTray = useCallback(() => {
    // The flyout ("Pop Out Dashboard") is now its own dedicated OS window
    // rather than a state of the shared `main` window's surface-mode
    // machine, so "back to tray" opens it directly instead of switching
    // `main`'s mode.
    void openFlyoutWindow().catch(() => {});
  }, []);
  const openAbout = useCallback(() => {
    void openSettingsTab("about");
  }, [openSettingsTab]);
  const quitApp = useCallback(() => {
    void quitApplication();
  }, []);

  const headerActions = [
    { icon: "⊟", title: t("TooltipBackToTray"), onClick: goTray },
  ];

  const footerRows: MenuFooterRow[] = [
    { icon: "⚙", label: t("TooltipSettings"), shortcut: "Ctrl+,", onClick: openSettings },
    { icon: "ℹ", label: t("MenuAbout"), onClick: openAbout },
    { icon: "✕", label: t("MenuQuit"), shortcut: "Ctrl+Q", onClick: quitApp },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case "r":
          e.preventDefault();
          refresh();
          break;
        case ",":
          e.preventDefault();
          openSettings();
          break;
        case "q":
          e.preventDefault();
          quitApp();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refresh, openSettings, quitApp]);

  const banner = (
    <UpdateBanner
      updateState={updateState}
      onCheck={checkNow}
      onDownload={download}
      onApply={apply}
      onDismiss={dismiss}
      onOpenRelease={openRelease}
    />
  );

  const resetOptions = useResetStageOptions(settings, "dashboard");
  const stageProviders = toStageProviders(sorted, usageConfigFromSnapshot(settings), resetOptions);
  const catalog = resolveCatalogTheme(settings, "dashboard").slug;

  return (
    <div className="popout-scale-shell">
      {settingsLaunchError && <p role="alert" style={{padding:12,color:"#ffb4ab"}}>{settingsLaunchError}</p>}
      <MenuSurface
        variant="popout"
        catalogTheme={catalog}
        titleBar={<PopOutTitleBar />}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
        actions={headerActions}
        banner={banner}
        footerRows={footerRows}
      >
        {providerId ? <DashboardBody
          allProviders={sorted}
          visibleProviders={visibleProviders}
          stageProviders={stageProviders}
          isRefreshing={isRefreshing}
          hasCachedData={hasCachedData}
          refreshingProviderIds={refreshingProviderIds}
          selectedProviderId={selectedProviderId}
          gridExpanded={gridExpanded}
          onExpandedChange={setGridExpanded}
          onSelect={handleGridClick}
          onReorder={handleReorder}
          catalog={catalog}
          settings={settings}
          onSettings={openSettings}
          cardRef={setCardRef}
          hideHero
        /> : <DashboardHost state={state} onOpenProviders={() => { void openSettingsTab("providers"); }} />}
      </MenuSurface>
    </div>
  );
}
