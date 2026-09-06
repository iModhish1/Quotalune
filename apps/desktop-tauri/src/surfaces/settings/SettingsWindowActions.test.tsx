import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import SettingsWindowActions from './SettingsWindowActions';

const native = vi.hoisted(() => ({ isFullscreen: vi.fn(), setFullscreen: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => native }));
beforeEach(() => { vi.clearAllMocks(); native.isFullscreen.mockResolvedValue(false); native.setFullscreen.mockResolvedValue(undefined); });
it('enters fullscreen and offers a visible exit control', async () => {
  render(<SettingsWindowActions />);
  fireEvent.click(screen.getByRole('button', {name:'Full screen (F11)'}));
  await waitFor(() => expect(native.setFullscreen).toHaveBeenCalledWith(true));
  expect(await screen.findByRole('button', {name:'Exit full screen (Esc)'})).toBeInTheDocument();
});
it('exits fullscreen using Escape without affecting ordinary Escape', async () => {
  render(<SettingsWindowActions />);
  fireEvent.keyDown(window, {key:'Escape'});
  await waitFor(() => expect(native.isFullscreen).toHaveBeenCalled());
  expect(native.setFullscreen).not.toHaveBeenCalled();
  native.isFullscreen.mockResolvedValue(true);
  fireEvent.keyDown(window, {key:'Escape'});
  await waitFor(() => expect(native.setFullscreen).toHaveBeenCalledWith(false));
});
it('reports a denied window action instead of an unhandled rejection', async () => {
  native.setFullscreen.mockRejectedValue(new Error('denied'));
  render(<SettingsWindowActions />);
  fireEvent.click(screen.getByRole('button', {name:'Full screen (F11)'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('denied');
});
