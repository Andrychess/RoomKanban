import { app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import type { FilePreviewPayload } from '../../shared/filePreview'
import { resolveAppIconPath } from '../appIcon'

export function openFilePreviewWindow(payload: FilePreviewPayload): BrowserWindow {
  const iconPath = resolveAppIconPath()
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined

  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 480,
    minHeight: 360,
    show: false,
    autoHideMenuBar: true,
    title: `Просмотр — ${payload.fileName}`,
    icon: icon && !icon.isEmpty() ? icon : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/preview.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  const sendPayload = (): void => {
    win.webContents.send('file-preview-init', payload)
  }

  win.webContents.on('did-finish-load', sendPayload)

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/preview/index.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/preview/index.html'))
  }

  return win
}
