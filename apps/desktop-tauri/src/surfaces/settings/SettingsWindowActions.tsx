import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Native fullscreen is distinct from Windows maximize/Snap, owned by its caption. */
export default function SettingsWindowActions() {
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
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
      setError(`Window action failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally { pending.current = false; }
  }, []);
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
    <button type="button" className="settings-fullscreen" onClick={() => void change()}>
      {fullscreen ? 'Exit full screen (Esc)' : 'Full screen (F11)'}
    </button>
    {error && <span role="alert">{error}</span>}
  </>;
}
