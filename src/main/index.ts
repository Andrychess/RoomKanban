import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'path'
import { SettingsStore } from './settings/SettingsStore'
import { RoomManager } from './room/RoomManager'
import { autoOpenRoom, closeRoomFully, registerHandlers } from './ipc/registerHandlers'

const isDev = !app.isPackaged

const settings = new SettingsStore()
const roomManager = new RoomManager(settings)

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Комната',
      submenu: [
        {
          label: 'Сменить комнату…',
          click: () => mainWindow?.webContents.send('navigate', 'welcome')
        },
        {
          label: 'Создать новую комнату…',
          click: () => mainWindow?.webContents.send('navigate', 'create')
        },
        { type: 'separator' },
        {
          label: 'Закрыть комнату',
          click: async () => {
            await closeRoomFully(roomManager)
            mainWindow?.webContents.send('navigate', 'welcome')
            mainWindow?.webContents.send('room-closed')
          }
        }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Календарь',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => mainWindow?.webContents.send('navigate', 'calendar')
        },
        {
          label: 'Состав комнаты',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => mainWindow?.webContents.send('navigate', 'team')
        },
        {
          label: 'Просрочено',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => mainWindow?.webContents.send('navigate', 'overdue')
        },
        {
          label: 'Сводка начальника',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => mainWindow?.webContents.send('navigate', 'dashboard')
        },
        {
          label: 'Архив задач',
          click: () => mainWindow?.webContents.send('navigate', 'archive')
        },
        {
          label: 'Обмен файлами',
          click: () => mainWindow?.webContents.send('navigate', 'exchange')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  await settings.load()
  registerHandlers(roomManager, settings)
  buildMenu()
  createWindow()

  const room = await autoOpenRoom(roomManager)
  if (room && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('room-auto-opened', room)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
