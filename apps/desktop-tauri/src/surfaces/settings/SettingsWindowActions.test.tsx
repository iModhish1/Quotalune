import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import SettingsWindowActions from './SettingsWindowActions';

const native = vi.hoisted(() => ({ isFullscreen: vi.fn(), setFullscreen: vi.fn(), isMaximized: vi.fn(), toggleMaximize: vi.fn(), onResized: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => native }));
vi.mock('../../hooks/useLocale',()=>({useLocale:()=>({t:(key:string)=>({MaximizeWindow:'Maximize window',RestoreWindow:'Restore window',EnterFullScreen:'Full screen (F11)',ExitFullScreen:'Exit full screen (Esc)',WindowActionFailed:'Window action failed'}[key]??key)})}));
beforeEach(() => { vi.clearAllMocks(); native.isFullscreen.mockResolvedValue(false); native.setFullscreen.mockResolvedValue(undefined); native.isMaximized.mockResolvedValue(false); native.onResized.mockResolvedValue(() => {}); });
it('maximizes and restores through the native window API', async () => {
  native.toggleMaximize.mockImplementation(async () => { native.isMaximized.mockResolvedValue(true); });
  render(<SettingsWindowActions />);
  fireEvent.click(screen.getByRole('button', {name:'Maximize window'}));
  expect(await screen.findByRole('button', {name:'Restore window'})).toBeInTheDocument();
  expect(native.toggleMaximize).toHaveBeenCalledTimes(1);
  native.toggleMaximize.mockImplementation(async () => { native.isMaximized.mockResolvedValue(false); });
  fireEvent.click(screen.getByRole('button', {name:'Restore window'}));
  expect(await screen.findByRole('button', {name:'Maximize window'})).toBeInTheDocument();
});
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
