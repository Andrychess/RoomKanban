import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppUpdateStatus } from '../../shared/appUpdate'
import { createInitialAppUpdateStatus } from '../../shared/appUpdate'

function humanizeUpdateError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (lower.includes('net') || lower.includes('enotfound') || lower.includes('network')) {
    return 'Нет подключения к интернету. Проверьте сеть и попробуйте снова.'
  }
  if (lower.includes('404') || lower.includes('latest.yml')) {
    return 'Обновления пока не опубликованы. Попробуйте позже.'
  }
  if (lower.includes('401') || lower.includes('403')) {
    return 'Не удалось получить доступ к серверу обновлений.'
  }

  return 'Не удалось проверить обновления. Попробуйте позже.'
}

export class AppUpdater {
  private status: AppUpdateStatus
  private userInitiatedFlow = false

  constructor() {
    this.status = createInitialAppUpdateStatus(app.getVersion(), app.isPackaged)
  }

  init(): void {
    if (!app.isPackaged) return

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false

    autoUpdater.on('checking-for-update', () => {
      this.patchStatus({
        phase: 'checking',
        message: 'Проверяем обновления…'
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.userInitiatedFlow = false
      this.patchStatus({
        phase: 'not-available',
        availableVersion: undefined,
        progress: undefined,
        message: 'У вас установлена последняя версия.'
      })
    })

    autoUpdater.on('update-available', (info) => {
      const downloading = this.userInitiatedFlow
      this.patchStatus({
        phase: 'available',
        availableVersion: info.version,
        progress: undefined,
        message: downloading
          ? `Доступна версия ${info.version}. Загружаем…`
          : `Доступна версия ${info.version}. Нажмите «Обновить», чтобы установить.`
      })
      if (downloading) {
        void this.downloadUpdate()
      }
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Math.round(progress.percent)))
      this.patchStatus({
        phase: 'downloading',
        progress: percent,
        message: `Загрузка обновления: ${percent}%`
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.userInitiatedFlow = false
      this.patchStatus({
        phase: 'downloaded',
        availableVersion: info.version,
        progress: 100,
        message: 'Обновление загружено. Нажмите «Установить», чтобы перезапустить приложение.'
      })
    })

    autoUpdater.on('error', (err) => {
      this.userInitiatedFlow = false
      this.patchStatus({
        phase: 'error',
        progress: undefined,
        message: humanizeUpdateError(err)
      })
    })
  }

  isEnabled(): boolean {
    return app.isPackaged
  }

  getStatus(): AppUpdateStatus {
    return this.status
  }

  async checkOnStartup(): Promise<AppUpdateStatus> {
    if (!app.isPackaged) return this.status
    this.userInitiatedFlow = false
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.patchStatus({
        phase: 'error',
        message: humanizeUpdateError(err)
      })
    }
    return this.status
  }

  async startUpdateFlow(): Promise<AppUpdateStatus> {
    if (!app.isPackaged) {
      this.patchStatus({
        phase: 'not-available',
        message: 'Обновления доступны только в установленной версии приложения.'
      })
      return this.status
    }

    if (this.status.phase === 'downloaded') {
      this.quitAndInstall()
      return this.status
    }

    if (this.status.phase === 'available') {
      this.userInitiatedFlow = true
      await this.downloadUpdate()
      return this.status
    }

    if (this.status.phase === 'checking' || this.status.phase === 'downloading') {
      return this.status
    }

    this.userInitiatedFlow = true
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.userInitiatedFlow = false
      this.patchStatus({
        phase: 'error',
        message: humanizeUpdateError(err)
      })
    }
    return this.status
  }

  quitAndInstall(): void {
    if (this.status.phase !== 'downloaded') return
    autoUpdater.quitAndInstall(false, true)
  }

  private async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      this.userInitiatedFlow = false
      this.patchStatus({
        phase: 'error',
        message: humanizeUpdateError(err)
      })
    }
  }

  private patchStatus(partial: Partial<AppUpdateStatus>): void {
    this.status = { ...this.status, ...partial }
    this.broadcast()
  }

  private broadcast(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('app-update-status', this.status)
      }
    }
  }
}
