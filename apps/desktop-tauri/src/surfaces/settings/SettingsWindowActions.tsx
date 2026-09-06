import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {useLocale} from '../../hooks/useLocale';

/** Native fullscreen is distinct from Windows maximize/Snap, owned by its caption. */
export default function SettingsWindowActions() {
  const {t}=useLocale();
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const win = getCurrentWindow();
    const sync = async () => {
      try {
        const [full, max] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
        if (!disposed) { setFullscreen(full); setMaximized(max); }
      } catch { /* Browser previews have no native window. Actions report errors. */ }
    };
    void sync();
    void win.onResized(() => { void sync(); }).then(stop => {
      if (disposed) stop(); else unlisten = stop;
    }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, []);
  const maximize = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const win = getCurrentWindow();
      if (await win.isFullscreen()) await win.setFullscreen(false);
      await win.toggleMaximize();
      setFullscreen(false);
      setMaximized(await win.isMaximized());
      setError(null);
    } catch (cause) {
      setError(`${t('WindowActionFailed')}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { pending.current = false; }
  }, [t]);
  const change = useCallback(async (exitOnly = false) => {
    if (pending.current) return;
    pending.current = true;
    try {
      const win = getCurrentWindow();
      const current = await win.isFullscreen();
      if (exitOnly && !current) return;
      await win.setFullscreen(!current);
      setFullscreen(!current);
      setError(null);
    } catch (cause) {
      setError(`${t('WindowActionFailed')}: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { pending.current = false; }
  }, [t]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'F11' && event.key !== 'Escape')) return;
      if (event.key === 'F11') event.preventDefault();
      void change(event.key === 'Escape');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [change]);
  return <>
    <button type="button" className="settings-fullscreen" data-window-action="maximize" data-active={maximized} onClick={() => void maximize()}>
      {maximized ? t('RestoreWindow') : t('MaximizeWindow')}
    </button>
    <button type="button" className="settings-fullscreen" data-window-action="fullscreen" data-active={fullscreen} onClick={() => void change()}>
      {fullscreen ? t('ExitFullScreen') : t('EnterFullScreen')}
    </button>
    {error && <span role="alert">{error}</span>}
  </>;
}
