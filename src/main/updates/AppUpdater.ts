import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { AppUpdateStatus } from '../../shared/appUpdate'
import { createInitialAppUpdateStatus } from '../../shared/appUpdate'

const NETWORK_ERROR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ERR_INTERNET_DISCONNECTED'
])

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

function httpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const status = (err as { statusCode: unknown }).statusCode
    if (typeof status === 'number') return status
  }
  return undefined
}

/** Без stack trace: в нём часто есть `net.js`, из-за чего ложно срабатывает проверка сети. */
function primaryErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const stackStart = raw.indexOf('\n    at ')
  return (stackStart >= 0 ? raw.slice(0, stackStart) : raw).trim()
}

function isUnpublishedUpdateError(err: unknown, message: string): boolean {
  const code = errorCode(err)
  const status = httpStatus(err)
  const lower = message.toLowerCase()

  return (
    code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' ||
    code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' ||
    code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ||
    status === 404 ||
    lower.includes('no published versions') ||
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('latest.yml') ||
    lower.includes('cannot find') ||
    lower.includes('no published') ||
    lower.includes('releases/download') ||
    lower.includes('production release')
  )
}

function isNetworkUpdateError(err: unknown, message: string): boolean {
  const code = errorCode(err)
  const lower = message.toLowerCase()

  if (code && NETWORK_ERROR_CODES.has(code)) return true

  return (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('enetunreach') ||
    lower.includes('network error') ||
    lower.includes('network request failed') ||
    /net::err_[a-z_]+/.test(lower)
  )
}

function humanizeUpdateError(err: unknown): string {
  const message = primaryErrorMessage(err)
  const lower = message.toLowerCase()

  if (isUnpublishedUpdateError(err, message)) {
    return 'Обновления ещё не опубликованы на GitHub. Попросите IT выполнить первую публикацию релиза (npm run dist:publish или git tag vX.Y.Z).'
  }
  if (
    httpStatus(err) === 401 ||
    httpStatus(err) === 403 ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return 'Не удалось получить доступ к серверу обновлений. Репозиторий может быть приватным — нужна настройка доступа.'
  }
  if (isNetworkUpdateError(err, message)) {
    return 'Нет подключения к интернету. Проверьте сеть и попробуйте снова.'
  }

  return 'Не удалось проверить обновления. Обратитесь к IT-администратору.'
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
      const raw = err instanceof Error ? err.message : String(err)
      console.error('[app-update]', raw)
      if (err instanceof Error && err.stack) {
        console.error('[app-update] stack', err.stack)
      }
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
