import { BrowserWindow, dialog, ipcMain } from 'electron'
import { RoomError, RoomManager } from '../room/RoomManager'
import { SettingsStore } from '../settings/SettingsStore'
import { BoardSyncManager } from '../sync/BoardSyncManager'
import { TaskLockStore } from '../sync/TaskLockStore'
import { buildChiefDashboard, type ChiefDashboardData } from '../../shared/chiefDashboard'
import { filterOverdueTasks } from '../../shared/overdue'
import { ReminderScheduler } from '../reminders/ReminderScheduler'
import { TaskHistoryStore } from '../sync/TaskHistoryStore'
import { TaskPrioritiesStore } from '../sync/TaskPrioritiesStore'
import { TaskTemplatesStore } from '../sync/TaskTemplatesStore'
import { ReminderSettingsStore } from '../sync/ReminderSettingsStore'
import { ExchangeStore } from '../sync/ExchangeStore'
import { refreshRoomSync } from '../sync/refreshRoomSync'
import { TaskTypesStore } from '../sync/TaskTypesStore'
import type { ColumnSortId } from '../../shared/columnSort'
import type {
  CreateTaskInput,
  EnterRoomCredentials,
  ReminderSettings,
  Room,
  Task,
  TaskFileKind,
  TaskHistoryEntry,
  TaskPriority,
  TaskTemplate,
  TaskType,
  UpdateTaskInput
} from '../../shared/types'
import type { TaskStatus } from '../../shared/taskStatus'
import { listKnownRooms } from '../room/listRooms'

let boardSync: BoardSyncManager | null = null
let taskLockStore: TaskLockStore | null = null
let taskTypesStore: TaskTypesStore | null = null
let taskPrioritiesStore: TaskPrioritiesStore | null = null
let taskHistoryStore: TaskHistoryStore | null = null
let taskTemplatesStore: TaskTemplatesStore | null = null
let reminderSettingsStore: ReminderSettingsStore | null = null
let reminderScheduler: ReminderScheduler | null = null
let exchangeStore: ExchangeStore | null = null
let settingsStore: SettingsStore

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function toErrorMessage(err: unknown): string {
  if (err instanceof RoomError) return err.message
  if (err instanceof Error) return err.message
  return 'Неизвестная ошибка'
}

function requireChief(room: Room | null): Room {
  if (!room) throw new Error('Комната не открыта')
  if (!room.isChief) throw new Error('Только начальник комнаты может выполнить это действие')
  return room
}

async function startRoomSync(room: Room, roomManager: RoomManager): Promise<void> {
  boardSync?.stop()
  taskLockStore?.stop()
  taskTypesStore?.stop()
  taskPrioritiesStore?.stop()
  taskTemplatesStore?.stop()
  exchangeStore?.stop()
  reminderScheduler?.stop()

  taskTypesStore = new TaskTypesStore(room.path)
  await taskTypesStore.start()

  taskPrioritiesStore = new TaskPrioritiesStore(room.path)
  await taskPrioritiesStore.start()

  taskHistoryStore = new TaskHistoryStore(room.path)
  await taskHistoryStore.ensureDefaults()

  boardSync = new BoardSyncManager(
    room.path,
    room.pcId,
    taskTypesStore,
    taskPrioritiesStore,
    taskHistoryStore,
    () => {
      const r = roomManager.getCurrentRoom()
      const key = r?.pcId ?? room.pcId
      const name = r?.state.employees[key]?.name ?? 'Сотрудник'
      return { key, name }
    }
  )
  await boardSync.start()

  taskLockStore = new TaskLockStore(room.path)
  taskLockStore.start()

  taskTemplatesStore = new TaskTemplatesStore(room.path)
  await taskTemplatesStore.start()

  reminderSettingsStore = new ReminderSettingsStore(room.path)
  await reminderSettingsStore.ensureDefaults()

  reminderScheduler = new ReminderScheduler(
    () => roomManager.getCurrentRoom(),
    () => boardSync,
    () => reminderSettingsStore,
    settingsStore
  )
  reminderScheduler.start()

  exchangeStore = new ExchangeStore(room.path)
  await exchangeStore.start()
}

export function registerHandlers(
  roomManager: RoomManager,
  settings: SettingsStore
): void {
  settingsStore = settings

  function requireOpenRoom(): Room {
    const room = roomManager.getCurrentRoom()
    if (!room) throw new Error('Комната не открыта')
    return room
  }

  async function assertTaskEditLock(taskId: string): Promise<void> {
    const room = requireOpenRoom()
    if (!taskLockStore) return
    const lock = await taskLockStore.getLock(taskId)
    if (lock && lock.employee_key !== room.pcId) {
      throw new Error(`Задачу редактирует: ${lock.employee_name}`)
    }
  }
  ipcMain.handle('get-app-theme', async () => settingsStore.getTheme())

  ipcMain.handle('set-app-theme', async (_e, theme: 'light' | 'dark') => {
    return settingsStore.setTheme(theme)
  })

  ipcMain.handle('select-folder', async () => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory']
        })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('select-task-files', async () => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths
  })

  ipcMain.handle('get-recent-rooms', () => settings.getRecentRooms())
  ipcMain.handle('list-rooms', async () => listKnownRooms(settings))
  /** Активный ключ сотрудника в открытой комнате */
  ipcMain.handle('get-active-employee-key', () => roomManager.getCurrentRoom()?.pcId ?? null)
  ipcMain.handle('get-current-room', () => roomManager.getCurrentRoom())

  ipcMain.handle('peek-room', async (_e, folderPath: string) => {
    try {
      return await roomManager.peekRoom(folderPath)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle(
    'create-room',
    async (
      _e,
      folderPath: string,
      roomName: string,
      userName: string,
      userRole: string,
      roomPassword?: string,
      chiefPassword?: string
    ) => {
      try {
        const room = await roomManager.createRoom(folderPath, roomName, userName, userRole, {
          roomPassword,
          chiefPassword
        })
        await startRoomSync(room, roomManager)
        return room
      } catch (err) {
        throw new Error(toErrorMessage(err))
      }
    }
  )

  ipcMain.handle('resolve-room-entry', async (_e, folderPath: string) => {
    try {
      return await roomManager.resolveRoomEntry(folderPath)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle(
    'enter-room',
    async (
      _e,
      folderPath: string,
      employeeKey: string,
      credentials: EnterRoomCredentials = {}
    ) => {
      try {
        const room = await roomManager.enterRoom(folderPath, employeeKey, credentials)
        await startRoomSync(room, roomManager)
        return room
      } catch (err) {
        throw new Error(toErrorMessage(err))
      }
    }
  )

  ipcMain.handle('verify-room-password', async (_e, folderPath: string, password: string) => {
    try {
      return await roomManager.verifyRoomPassword(folderPath, password)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('set-room-password', async (_e, password: string | null) => {
    try {
      return await roomManager.setRoomPassword(password)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('set-employee-password', async (_e, employeeKey: string, password: string | null) => {
    try {
      return await roomManager.setEmployeePassword(employeeKey, password)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('get-column-sorts', (_e, roomPath: string) => {
    return settings.getAllColumnSorts(roomPath)
  })

  ipcMain.handle(
    'set-column-sort',
    async (_e, roomPath: string, column: TaskStatus, sortId: ColumnSortId) => {
      await settings.setColumnSort(roomPath, column, sortId)
      return settings.getAllColumnSorts(roomPath)
    }
  )

  ipcMain.handle('add-employee', async (_e, name: string, role: string) => {
    try {
      return await roomManager.addEmployee(name, role)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('update-employee', async (_e, employeeKey: string, name: string, role: string) => {
    try {
      return await roomManager.updateEmployee(employeeKey, name, role)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('remove-employee', async (_e, employeeKey: string) => {
    try {
      const room = requireChief(roomManager.getCurrentRoom())
      const chiefKey = room.state.chief_pc
      const updated = await roomManager.removeEmployee(employeeKey)
      if (boardSync) {
        await boardSync.reassignEmployeeTasks(employeeKey, chiefKey)
      }
      return updated
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('close-room', async () => {
    await closeRoomFully(roomManager)
  })

  ipcMain.handle('get-task-types', async () => {
    if (!taskTypesStore) return []
    return taskTypesStore.getTypes()
  })

  ipcMain.handle('save-task-types', async (_e, types: TaskType[]) => {
    requireChief(roomManager.getCurrentRoom())
    if (!taskTypesStore) throw new Error('Комната не открыта')
    try {
      await taskTypesStore.saveTypes(types)
      const saved = await taskTypesStore.getTypes()
      if (boardSync) {
        await boardSync.reassignOrphanTypes(
          saved.map((t) => t.id),
          saved[0].id
        )
      }
      return saved
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('get-task-priorities', async () => {
    if (!taskPrioritiesStore) return []
    return taskPrioritiesStore.getPriorities()
  })

  ipcMain.handle('save-task-priorities', async (_e, priorities: TaskPriority[]) => {
    requireChief(roomManager.getCurrentRoom())
    if (!taskPrioritiesStore) throw new Error('Комната не открыта')
    try {
      await taskPrioritiesStore.savePriorities(priorities)
      const saved = await taskPrioritiesStore.getPriorities()
      if (boardSync) {
        await boardSync.reassignOrphanPriorities(
          saved.map((p) => p.id),
          saved[0].id
        )
      }
      return saved
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('subscribe-task-priorities', (event) => {
    if (!taskPrioritiesStore) return

    const listener = (priorities: TaskPriority[]) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('task-priorities-updated', priorities)
      }
    }

    const unsubscribe = taskPrioritiesStore.onPrioritiesChanged(listener)
    void taskPrioritiesStore.getPriorities().then(listener)

    event.sender.on('destroyed', () => unsubscribe())
  })

  ipcMain.handle('subscribe-task-types', (event) => {
    if (!taskTypesStore) return

    const listener = (types: TaskType[]) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('task-types-updated', types)
      }
    }

    const unsubscribe = taskTypesStore.onTypesChanged(listener)
    void taskTypesStore.getTypes().then(listener)

    event.sender.on('destroyed', () => unsubscribe())
  })

  ipcMain.handle('get-tasks', async () => {
    if (!boardSync) return []
    return boardSync.getTasks()
  })

  ipcMain.handle('create-task', async (_e, input: CreateTaskInput) => {
    if (!boardSync) throw new Error('Комната не открыта')
    return boardSync.createTask(input)
  })

  ipcMain.handle('update-task', async (_e, input: UpdateTaskInput) => {
    if (!boardSync) throw new Error('Комната не открыта')
    await assertTaskEditLock(input.id)
    return boardSync.updateTask(input)
  })

  ipcMain.handle('refresh-room-sync', async () => {
    requireOpenRoom()
    return refreshRoomSync({
      boardSync,
      exchangeStore,
      taskTypesStore,
      taskPrioritiesStore,
      taskTemplatesStore
    })
  })

  ipcMain.handle('acquire-task-lock', async (_e, taskId: string) => {
    const room = requireOpenRoom()
    if (!taskLockStore) throw new Error('Комната не открыта')
    const name = room.state.employees[room.pcId]?.name ?? 'Сотрудник'
    return taskLockStore.acquire(taskId, room.pcId, name)
  })

  ipcMain.handle('release-task-lock', async (_e, taskId: string) => {
    const room = requireOpenRoom()
    if (!taskLockStore) return
    await taskLockStore.release(taskId, room.pcId)
  })

  ipcMain.handle('refresh-task-lock', async (_e, taskId: string) => {
    const room = requireOpenRoom()
    if (!taskLockStore) return false
    return taskLockStore.refresh(taskId, room.pcId)
  })

  ipcMain.handle('get-overdue-tasks', async () => {
    requireChief(requireOpenRoom())
    if (!boardSync) return []
    const tasks = await boardSync.getTasks()
    return filterOverdueTasks(tasks)
  })

  ipcMain.handle('update-task-status', async (_e, taskId: string, status: Task['status']) => {
    if (!boardSync) throw new Error('Комната не открыта')
    await boardSync.updateTaskStatus(taskId, status)
  })

  ipcMain.handle('clear-done-tasks', async () => {
    if (!boardSync) throw new Error('Комната не открыта')
    return boardSync.archiveDoneTasks()
  })

  ipcMain.handle('archive-done-tasks', async () => {
    if (!boardSync) throw new Error('Комната не открыта')
    return boardSync.archiveDoneTasks()
  })

  ipcMain.handle('get-archived-tasks', async () => {
    if (!boardSync) return []
    return boardSync.getArchivedTasks()
  })

  ipcMain.handle('restore-archived-task', async (_e, taskId: string) => {
    if (!boardSync) throw new Error('Комната не открыта')
    return boardSync.restoreArchivedTask(taskId)
  })

  ipcMain.handle('get-task-history', async (_e, taskId: string) => {
    if (!taskHistoryStore) return []
    return taskHistoryStore.getForTask(taskId)
  })

  ipcMain.handle('add-task-comment', async (_e, taskId: string, text: string) => {
    if (!boardSync) throw new Error('Комната не открыта')
    return boardSync.addTaskComment(taskId, text)
  })

  ipcMain.handle('get-chief-dashboard', async () => {
    const room = requireChief(requireOpenRoom())
    if (!boardSync) {
      const empty: ChiefDashboardData = {
        overdue_count: 0,
        without_due_count: 0,
        stuck_tasks: [],
        workload: []
      }
      return empty
    }
    const tasks = await boardSync.getTasks()
    return buildChiefDashboard(tasks, room.state.employees)
  })

  ipcMain.handle('get-task-templates', async () => {
    if (!taskTemplatesStore) return []
    return taskTemplatesStore.getTemplates()
  })

  ipcMain.handle('save-task-templates', async (_e, templates: TaskTemplate[]) => {
    requireChief(requireOpenRoom())
    if (!taskTemplatesStore) throw new Error('Комната не открыта')
    return taskTemplatesStore.saveTemplates(templates)
  })

  ipcMain.handle('get-reminder-settings', async () => {
    if (!reminderSettingsStore) {
      return {
        days_before: [1, 3],
        notify_assignee: true,
        notify_chief: true,
        updated_at: 0
      } satisfies ReminderSettings
    }
    return reminderSettingsStore.getSettings()
  })

  ipcMain.handle('save-reminder-settings', async (_e, settings: ReminderSettings) => {
    requireChief(requireOpenRoom())
    if (!reminderSettingsStore) throw new Error('Комната не открыта')
    return reminderSettingsStore.saveSettings(settings)
  })

  ipcMain.handle('subscribe-task-templates', (event) => {
    if (!taskTemplatesStore) return
    const listener = (templates: TaskTemplate[]) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('task-templates-updated', templates)
      }
    }
    const unsubscribe = taskTemplatesStore.onTemplatesChanged(listener)
    void taskTemplatesStore.getTemplates().then(listener)
    event.sender.on('destroyed', () => unsubscribe())
  })

  ipcMain.handle(
    'open-task-file',
    async (_e, taskId: string, kind: TaskFileKind, fileId: string) => {
      if (!boardSync) throw new Error('Комната не открыта')
      await boardSync.openTaskFile(taskId, kind, fileId)
    }
  )

  ipcMain.handle('get-exchange-files', async () => {
    if (!exchangeStore) return {}
    return exchangeStore.getAll()
  })

  ipcMain.handle('add-exchange-files', async (_e, employeeKey: string, paths: string[]) => {
    const room = requireOpenRoom()
    if (!exchangeStore) throw new Error('Комната не открыта')
    if (!room.state.employees[employeeKey]) {
      throw new Error('Сотрудник не найден')
    }
    return exchangeStore.addFiles(employeeKey, paths)
  })

  ipcMain.handle('clear-exchange-files', async (_e, employeeKey: string) => {
    requireOpenRoom()
    if (!exchangeStore) throw new Error('Комната не открыта')
    return exchangeStore.clearEmployee(employeeKey)
  })

  ipcMain.handle('remove-exchange-file', async (_e, employeeKey: string, fileId: string) => {
    if (!exchangeStore) throw new Error('Комната не открыта')
    await exchangeStore.removeFile(employeeKey, fileId)
  })

  ipcMain.handle('open-exchange-file', async (_e, employeeKey: string, fileId: string) => {
    if (!exchangeStore) throw new Error('Комната не открыта')
    await exchangeStore.openFile(employeeKey, fileId)
  })

  ipcMain.handle('subscribe-exchange', (event) => {
    if (!exchangeStore) return

    const listener = (files: Record<string, import('../../shared/types').TaskFile[]>) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('exchange-updated', files)
      }
    }

    const unsubscribe = exchangeStore.onExchangeChanged(listener)
    void exchangeStore.getAll().then(listener)

    event.sender.on('destroyed', () => unsubscribe())
  })

  ipcMain.handle('subscribe-tasks', (event) => {
    if (!boardSync) return

    const listener = (tasks: Task[]) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('tasks-updated', tasks)
      }
    }

    const unsubscribe = boardSync.onTasksChanged(listener)
    void boardSync.getTasks().then(listener)

    event.sender.on('destroyed', () => unsubscribe())
  })
}

export async function closeRoomFully(roomManager: RoomManager): Promise<void> {
  const room = roomManager.getCurrentRoom()
  if (room && taskLockStore) {
    await taskLockStore.releaseAllForEmployee(room.pcId).catch(() => {})
  }
  boardSync?.stop()
  boardSync = null
  taskLockStore?.stop()
  taskLockStore = null
  taskTypesStore?.stop()
  taskTypesStore = null
  taskPrioritiesStore?.stop()
  taskPrioritiesStore = null
  taskTemplatesStore?.stop()
  taskTemplatesStore = null
  taskHistoryStore = null
  reminderSettingsStore = null
  reminderScheduler?.stop()
  reminderScheduler = null
  exchangeStore?.stop()
  exchangeStore = null
  await roomManager.closeRoom()
}

export async function autoOpenRoom(roomManager: RoomManager): Promise<Room | null> {
  const room = await roomManager.tryAutoOpen()
  if (room) await startRoomSync(room, roomManager)
  return room
}
