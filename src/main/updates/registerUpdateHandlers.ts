import { ipcMain } from 'electron'
import type { AppUpdater } from './AppUpdater'

export function registerUpdateHandlers(updater: AppUpdater): void {
  ipcMain.handle('get-app-update-status', () => updater.getStatus())
  ipcMain.handle('is-app-update-enabled', () => updater.isEnabled())
  ipcMain.handle('start-app-update', () => updater.startUpdateFlow())
  ipcMain.handle('check-app-update-on-startup', () => updater.checkOnStartup())
}
