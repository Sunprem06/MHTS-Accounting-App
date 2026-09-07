import type { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { UPDATE_STATUS_EVENT, type UpdateStatus } from '../shared/ipc';

// Updates are opportunistic, never required — matches the Blueprint's "no
// phone-home dependency for core operation" principle. Once an update IS
// found, download it automatically in the background so it's ready the
// moment the user chooses to restart, but never install/restart without
// that explicit action.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

let boundWindow: BrowserWindow | null = null;

function send(status: UpdateStatus): void {
  if (boundWindow && !boundWindow.isDestroyed()) {
    boundWindow.webContents.send(UPDATE_STATUS_EVENT, status);
  }
}

/** Wires autoUpdater's events to push status to the given window. Call once, right after the main window is created. */
export function initAutoUpdater(window: BrowserWindow): void {
  boundWindow = window;

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => send({ state: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (error) => send({ state: 'error', message: error.message }));
}

/** Both the automatic startup check and the user's manual "Check for Updates" action call this same function. Throws if there's no packaged update feed (e.g. running unpackaged in dev) or no network — callers decide whether that's fatal. */
export async function checkForUpdate(): Promise<void> {
  await autoUpdater.checkForUpdates();
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall();
}
