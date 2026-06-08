import { app, BrowserWindow, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { resolveAppIconPath } from './appIcon'
import { SettingsStore } from './settings/SettingsStore'
import { RoomManager } from './room/RoomManager'
import { autoOpenRoom, closeRoomFully, registerHandlers } from './ipc/registerHandlers'
import { AppUpdater } from './updates/AppUpdater'
import { registerUpdateHandlers } from './updates/registerUpdateHandlers'

const isDev = !app.isPackaged

const settings = new SettingsStore()
const roomManager = new RoomManager(settings)
const appUpdater = new AppUpdater()

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const iconPath = resolveAppIconPath()
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: false,
    icon: icon && !icon.isEmpty() ? icon : undefined,
    title: 'RoomKanban',
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
      label: 'Справка',
      submenu: [
        {
          label: 'Документация…',
          accelerator: 'F1',
          click: () => mainWindow?.webContents.send('open-help', null)
        },
        { type: 'separator' },
        {
          label: 'Обновить приложение…',
          click: () => mainWindow?.webContents.send('open-app-update')
        }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Мои задачи',
          click: () => mainWindow?.webContents.send('navigate', 'myTasks')
        },
        {
          label: 'Мой календарь',
          click: () => mainWindow?.webContents.send('navigate', 'myCalendar')
        },
        { type: 'separator' },
        {
          label: 'Все задачи',
          click: () => mainWindow?.webContents.send('navigate', 'kanban')
        },
        {
          label: 'По сотрудникам',
          click: () => mainWindow?.webContents.send('navigate', 'kanbanByEmployee')
        },
        {
          label: 'Календарь комнаты',
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
  if (process.platform === 'win32') {
    app.setAppUserModelId('ru.roomkanban.app')
  }

  await settings.load()
  appUpdater.init()
  registerHandlers(roomManager, settings)
  registerUpdateHandlers(appUpdater)
  buildMenu()
  createWindow()

  if (app.isPackaged) {
    setTimeout(() => {
      void appUpdater.checkOnStartup()
    }, 4000)
  }

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
