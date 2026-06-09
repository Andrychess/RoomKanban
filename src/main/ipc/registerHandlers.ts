import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
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
import { DepartmentMailSettingsStore } from '../sync/DepartmentMailSettingsStore'
import { DepartmentMailInboxStore } from '../sync/DepartmentMailInboxStore'
import { testImapConnection } from '../mail/testImapConnection'
import { fetchMailMessagesForPeriod } from '../mail/fetchMailMessages'
import { loadMailMessageBody } from '../mail/loadMailMessageBody'
import {
  clearMailAttachmentPreviewCache,
  resolveMailAttachmentForPreview
} from '../mail/mailAttachmentPreviewCache'
import { prepareMailTaskDraft, cleanupMailTaskDraftTemp } from '../mail/prepareMailTaskDraft'
import { formatMailError } from '../mail/imapClient'
import { openLocalFilePreview } from '../preview/openLocalFilePreview'
import type {
  DepartmentMailConnectionInput,
  DepartmentMailSettings,
  FetchDepartmentMailPeriodInput,
  MailTaskDraftProgress
} from '../../shared/departmentMail'
import { ExchangeStore } from '../sync/ExchangeStore'
import { NotesStore } from '../sync/NotesStore'
import { refreshRoomSync } from '../sync/refreshRoomSync'
import { TaskTypesStore } from '../sync/TaskTypesStore'
import { seedTestTasks } from '../dev/seedTestTasks'
import { SEED_TEST_TASK_COUNT } from '../../shared/seedTestTasks'
import type {
  CreateTaskInput,
  EnterRoomCredentials,
  ReminderSettings,
  Room,
  RoomNote,
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
import { setWindowSubscription } from './windowSubscriptions'
import { assertEmployeeKey, assertTaskId } from '../sync/syncPathSecurity'

let boardSync: BoardSyncManager | null = null
let taskLockStore: TaskLockStore | null = null
let taskTypesStore: TaskTypesStore | null = null
let taskPrioritiesStore: TaskPrioritiesStore | null = null
let taskHistoryStore: TaskHistoryStore | null = null
let taskTemplatesStore: TaskTemplatesStore | null = null
let reminderSettingsStore: ReminderSettingsStore | null = null
let departmentMailSettingsStore: DepartmentMailSettingsStore | null = null
let departmentMailInboxStore: DepartmentMailInboxStore | null = null
const mailDraftTempDirs = new Map<string, string>()
let reminderScheduler: ReminderScheduler | null = null
let exchangeStore: ExchangeStore | null = null
let notesStore: NotesStore | null = null
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
  await boardSync?.stop()
  taskLockStore?.stop()
  await taskTypesStore?.stop()
  await taskPrioritiesStore?.stop()
  await taskTemplatesStore?.stop()
  await exchangeStore?.stop()
  await notesStore?.stop()
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

  departmentMailSettingsStore = new DepartmentMailSettingsStore(room.path)
  await departmentMailSettingsStore.ensureDefaults()

  departmentMailInboxStore = new DepartmentMailInboxStore(room.path)
  await departmentMailInboxStore.ensureDefaults()

  reminderScheduler = new ReminderScheduler(
    () => roomManager.getCurrentRoom(),
    () => boardSync,
    () => reminderSettingsStore,
    settingsStore
  )
  reminderScheduler.start()

  exchangeStore = new ExchangeStore(room.path)
  await exchangeStore.start()

  notesStore = new NotesStore(room.path)
  await notesStore.start()
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
  ipcMain.handle('get-user-documentation', async () => {
    const { loadDocumentation } = await import('../help/loadUserGuide')
    return loadDocumentation()
  })

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

  ipcMain.handle('get-column-collapsed', (_e, roomPath: string) => {
    return settings.getAllColumnCollapsed(roomPath)
  })

  ipcMain.handle(
    'set-column-collapsed',
    async (_e, roomPath: string, column: TaskStatus, collapsed: boolean) => {
      await settings.setColumnCollapsed(roomPath, column, collapsed)
      return settings.getAllColumnCollapsed(roomPath)
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
    setWindowSubscription(event.sender, 'task-priorities', () => {
      const listener = (priorities: TaskPriority[]) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('task-priorities-updated', priorities)
        }
      }
      const unsubscribe = taskPrioritiesStore!.onPrioritiesChanged(listener)
      void taskPrioritiesStore!.getPriorities().then(listener)
      return unsubscribe
    })
  })

  ipcMain.handle('subscribe-task-types', (event) => {
    if (!taskTypesStore) return
    setWindowSubscription(event.sender, 'task-types', () => {
      const listener = (types: TaskType[]) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('task-types-updated', types)
        }
      }
      const unsubscribe = taskTypesStore!.onTypesChanged(listener)
      void taskTypesStore!.getTypes().then(listener)
      return unsubscribe
    })
  })

  ipcMain.handle('get-tasks', async () => {
    if (!boardSync) return []
    return boardSync.getTasks()
  })

  ipcMain.handle('create-task', async (_e, input: CreateTaskInput) => {
    if (!boardSync) throw new Error('Комната не открыта')
    return boardSync.createTask(input)
  })

  ipcMain.handle('seed-test-tasks', async () => {
    const room = requireOpenRoom()
    if (!room.isChief) throw new Error('Доступно только начальнику')
    if (!boardSync) throw new Error('Комната не открыта')
    const count = await seedTestTasks(boardSync, room)
    if (count !== SEED_TEST_TASK_COUNT) {
      throw new Error(`Создано ${count} из ${SEED_TEST_TASK_COUNT} задач`)
    }
    return { count }
  })

  ipcMain.handle('update-task', async (_e, input: UpdateTaskInput) => {
    if (!boardSync) throw new Error('Комната не открыта')
    assertTaskId(input.id)
    await assertTaskEditLock(input.id)
    try {
      return await boardSync.updateTask(input)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('refresh-room-sync', async () => {
    requireOpenRoom()
    try {
      return await refreshRoomSync({
        boardSync,
        exchangeStore,
        notesStore,
        taskTypesStore,
        taskPrioritiesStore,
        taskTemplatesStore
      })
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('acquire-task-lock', async (_e, taskId: string) => {
    const room = requireOpenRoom()
    if (!taskLockStore) throw new Error('Комната не открыта')
    assertTaskId(taskId)
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
    assertTaskId(taskId)
    try {
      await boardSync.updateTaskStatus(taskId, status)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('update-task-assignee', async (_e, taskId: string, assigneePc: string) => {
    if (!boardSync) throw new Error('Комната не открыта')
    assertTaskId(taskId)
    if (!assigneePc.trim()) throw new Error('Не указан ответственный')
    try {
      await boardSync.updateTaskAssignee(taskId, assigneePc)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
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
    assertTaskId(taskId)
    try {
      return await boardSync.restoreArchivedTask(taskId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('delete-task', async (_e, taskId: string) => {
    if (!boardSync) throw new Error('Комната не открыта')
    assertTaskId(taskId)
    try {
      await taskLockStore?.clearLock(taskId)
      await boardSync.deleteTask(taskId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('delete-archived-task', async (_e, taskId: string) => {
    if (!boardSync) throw new Error('Комната не открыта')
    assertTaskId(taskId)
    try {
      await taskLockStore?.clearLock(taskId)
      await boardSync.deleteTask(taskId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('get-task-history', async (_e, taskId: string) => {
    assertTaskId(taskId)
    if (!taskHistoryStore) return []
    return taskHistoryStore.getForTask(taskId)
  })

  ipcMain.handle('get-chief-dashboard', async () => {
    const room = requireChief(requireOpenRoom())
    if (!boardSync) {
      const empty: ChiefDashboardData = {
        overdue_count: 0,
        without_due_count: 0,
        stuck_tasks: [],
        workload: [],
        status_funnel: { review: 0, todo: 0, in_progress: 0, done: 0 }
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

  ipcMain.handle('get-department-mail-settings', async () => {
    if (!departmentMailSettingsStore) {
      return {
        enabled: false,
        host: '',
        port: 993,
        secure: true,
        user: '',
        updated_at: 0
      } satisfies DepartmentMailSettings
    }
    return departmentMailSettingsStore.getSettings()
  })

  ipcMain.handle('save-department-mail-settings', async (_e, settings: DepartmentMailSettings) => {
    requireChief(requireOpenRoom())
    if (!departmentMailSettingsStore) throw new Error('Комната не открыта')
    return departmentMailSettingsStore.saveSettings(settings)
  })

  ipcMain.handle('get-department-mail-has-password', async () => {
    const room = requireChief(requireOpenRoom())
    return settingsStore.hasDepartmentMailPassword(room.path)
  })

  ipcMain.handle('set-department-mail-password', async (_e, password: string | null) => {
    const room = requireChief(requireOpenRoom())
    await settingsStore.setDepartmentMailPassword(room.path, password)
  })

  ipcMain.handle(
    'test-department-mail-connection',
    async (_e, input: DepartmentMailConnectionInput) => {
      const room = requireChief(requireOpenRoom())
      const password =
        input.password.trim() ||
        (await settingsStore.getDepartmentMailPassword(room.path)) ||
        ''
      return testImapConnection({ ...input, password })
    }
  )

  async function resolveDepartmentMailConnection(
    room: Room,
    passwordOverride = ''
  ): Promise<DepartmentMailConnectionInput> {
    if (!departmentMailSettingsStore) throw new Error('Комната не открыта')
    const settings = await departmentMailSettingsStore.getSettings()
    const password =
      passwordOverride.trim() ||
      (await settingsStore.getDepartmentMailPassword(room.path)) ||
      ''
    return {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      user: settings.user,
      password
    }
  }

  ipcMain.handle('get-department-mail-inbox', async () => {
    requireChief(requireOpenRoom())
    if (!departmentMailInboxStore) throw new Error('Комната не открыта')
    return departmentMailInboxStore.getInbox()
  })

  ipcMain.handle(
    'fetch-department-mail-for-period',
    async (_e, input: FetchDepartmentMailPeriodInput) => {
      try {
        const room = requireChief(requireOpenRoom())
        if (!departmentMailInboxStore) throw new Error('Комната не открыта')
        const connection = await resolveDepartmentMailConnection(room)
        const inbox = await departmentMailInboxStore.getInbox()
        const known_ids = inbox.messages.map((m) => m.id)
        const fetched = await fetchMailMessagesForPeriod({
          connection,
          date_from: input.date_from,
          date_to: input.date_to,
          known_ids
        })
        if (fetched.messages.length > 0) {
          await departmentMailInboxStore.addMessages(fetched.messages)
        }
        const nextInbox = await departmentMailInboxStore.getInbox()
        return {
          added_count: fetched.messages.length,
          skipped_known: fetched.skipped_known,
          total_matched: fetched.total_matched,
          truncated: fetched.truncated,
          inbox: nextInbox
        }
      } catch (err) {
        throw new Error(formatMailError(err))
      }
    }
  )

  ipcMain.handle('get-department-mail-message-body', async (_e, messageId: string) => {
    const room = requireChief(requireOpenRoom())
    if (!departmentMailInboxStore) throw new Error('Комната не открыта')
    const inbox = await departmentMailInboxStore.getInbox()
    const message = inbox.messages.find((m) => m.id === messageId)
    if (!message) throw new Error('Письмо не найдено')
    const connection = await resolveDepartmentMailConnection(room)
    const body = await loadMailMessageBody(connection, message.uid)
    return { body }
  })

  ipcMain.handle(
    'open-department-mail-attachment',
    async (_e, messageId: string, attachmentIndex: number) => {
      try {
        const room = requireChief(requireOpenRoom())
        if (!departmentMailInboxStore) throw new Error('Комната не открыта')
        if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0) {
          throw new Error('Некорректный номер вложения')
        }

        const inbox = await departmentMailInboxStore.getInbox()
        const message = inbox.messages.find((m) => m.id === messageId)
        if (!message) throw new Error('Письмо не найдено')
        if (message.attachment_count === 0) throw new Error('У письма нет вложений')

        const connection = await resolveDepartmentMailConnection(room)
        const file = await resolveMailAttachmentForPreview({
          message,
          connection,
          attachmentIndex
        })
        await openLocalFilePreview(file.path, file.displayName)
      } catch (err) {
        throw new Error(formatMailError(err))
      }
    }
  )

  ipcMain.handle('discard-department-mail-message', async (_e, messageId: string) => {
    requireChief(requireOpenRoom())
    if (!departmentMailInboxStore) throw new Error('Комната не открыта')
    const updated = await departmentMailInboxStore.updateMessage(messageId, {
      status: 'discarded'
    })
    if (!updated) throw new Error('Письмо не найдено')
    return departmentMailInboxStore.getInbox()
  })

  ipcMain.handle('prepare-department-mail-task-draft', async (event, messageId: string) => {
    try {
      const room = requireChief(requireOpenRoom())
      if (!departmentMailInboxStore) throw new Error('Комната не открыта')
      const inbox = await departmentMailInboxStore.getInbox()
      const message = inbox.messages.find((m) => m.id === messageId)
      if (!message) throw new Error('Письмо не найдено')
      if (message.status === 'task_created' && message.task_id) {
        throw new Error('Из этого письма уже создана задача')
      }

      const existingTemp = mailDraftTempDirs.get(messageId)
      if (existingTemp) {
        await cleanupMailTaskDraftTemp(existingTemp)
        mailDraftTempDirs.delete(messageId)
      }
      await clearMailAttachmentPreviewCache(messageId)

      const connection = await resolveDepartmentMailConnection(room)
      const sendProgress = (progress: MailTaskDraftProgress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('department-mail-draft-progress', progress)
        }
      }

      const draft = await prepareMailTaskDraft({
        message,
        connection,
        assigneePc: room.state.chief_pc,
        onProgress: sendProgress
      })
      mailDraftTempDirs.set(messageId, draft.temp_dir)
      return draft
    } catch (err) {
      throw new Error(formatMailError(err))
    }
  })

  ipcMain.handle('cancel-department-mail-task-draft', async (_e, messageId: string) => {
    requireChief(requireOpenRoom())
    const tempDir = mailDraftTempDirs.get(messageId)
    if (tempDir) {
      await cleanupMailTaskDraftTemp(tempDir)
      mailDraftTempDirs.delete(messageId)
    }
  })

  ipcMain.handle(
    'mark-department-mail-message-task-created',
    async (_e, messageId: string, taskId: string) => {
      requireChief(requireOpenRoom())
      if (!departmentMailInboxStore) throw new Error('Комната не открыта')
      const tempDir = mailDraftTempDirs.get(messageId)
      if (tempDir) {
        await cleanupMailTaskDraftTemp(tempDir)
        mailDraftTempDirs.delete(messageId)
      }
      await departmentMailInboxStore.updateMessage(messageId, {
        status: 'task_created',
        task_id: taskId
      })
      return departmentMailInboxStore.getInbox()
    }
  )

  ipcMain.handle('subscribe-task-templates', (event) => {
    if (!taskTemplatesStore) return
    setWindowSubscription(event.sender, 'task-templates', () => {
      const listener = (templates: TaskTemplate[]) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('task-templates-updated', templates)
        }
      }
      const unsubscribe = taskTemplatesStore!.onTemplatesChanged(listener)
      void taskTemplatesStore!.getTemplates().then(listener)
      return unsubscribe
    })
  })

  ipcMain.handle('get-room-notes', async () => {
    if (!notesStore) return []
    return notesStore.getNotes()
  })

  ipcMain.handle('add-room-note', async (_e, title: string, text: string) => {
    const room = requireOpenRoom()
    if (!notesStore) throw new Error('Комната не открыта')
    try {
      return await notesStore.addNote(title, text, room.pcId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('update-room-note', async (_e, noteId: string, title: string, text: string) => {
    requireOpenRoom()
    if (!notesStore) throw new Error('Комната не открыта')
    try {
      return await notesStore.updateNote(noteId, title, text)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('delete-room-note', async (_e, noteId: string) => {
    requireOpenRoom()
    if (!notesStore) throw new Error('Комната не открыта')
    try {
      await notesStore.deleteNote(noteId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('subscribe-room-notes', (event) => {
    if (!notesStore) return
    setWindowSubscription(event.sender, 'room-notes', () => {
      const listener = (notes: RoomNote[]) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('room-notes-updated', notes)
        }
      }
      const unsubscribe = notesStore!.onNotesChanged(listener)
      void notesStore!.getNotes().then(listener)
      return unsubscribe
    })
  })

  ipcMain.handle('open-file-external', async (_e, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Некорректный путь к файлу')
    }
    await shell.openPath(filePath)
  })

  ipcMain.handle(
    'open-task-file',
    async (_e, taskId: string, kind: TaskFileKind, fileId: string) => {
      if (!boardSync) throw new Error('Комната не открыта')
      assertTaskId(taskId)
      try {
        await boardSync.openTaskFile(taskId, kind, fileId)
      } catch (err) {
        throw new Error(toErrorMessage(err))
      }
    }
  )

  ipcMain.handle('get-exchange-files', async () => {
    if (!exchangeStore) return {}
    return exchangeStore.getAll()
  })

  ipcMain.handle('add-exchange-files', async (_e, employeeKey: string, paths: string[]) => {
    const room = requireOpenRoom()
    if (!exchangeStore) throw new Error('Комната не открыта')
    assertEmployeeKey(employeeKey)
    if (!room.state.employees[employeeKey]) {
      throw new Error('Сотрудник не найден')
    }
    try {
      return await exchangeStore.addFiles(employeeKey, paths)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('clear-exchange-files', async (_e, employeeKey: string) => {
    requireOpenRoom()
    if (!exchangeStore) throw new Error('Комната не открыта')
    assertEmployeeKey(employeeKey)
    try {
      return await exchangeStore.clearEmployee(employeeKey)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('remove-exchange-file', async (_e, employeeKey: string, fileId: string) => {
    if (!exchangeStore) throw new Error('Комната не открыта')
    assertEmployeeKey(employeeKey)
    try {
      await exchangeStore.removeFile(employeeKey, fileId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('open-exchange-file', async (_e, employeeKey: string, fileId: string) => {
    if (!exchangeStore) throw new Error('Комната не открыта')
    assertEmployeeKey(employeeKey)
    try {
      await exchangeStore.openFile(employeeKey, fileId)
    } catch (err) {
      throw new Error(toErrorMessage(err))
    }
  })

  ipcMain.handle('subscribe-exchange', (event) => {
    if (!exchangeStore) return
    setWindowSubscription(event.sender, 'exchange', () => {
      const listener = (files: Record<string, import('../../shared/types').TaskFile[]>) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('exchange-updated', files)
        }
      }
      const unsubscribe = exchangeStore!.onExchangeChanged(listener)
      void exchangeStore!.getAll().then(listener)
      return unsubscribe
    })
  })

  ipcMain.handle('subscribe-tasks', (event) => {
    if (!boardSync) return
    setWindowSubscription(event.sender, 'tasks', () => {
      const listener = (tasks: Task[]) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('tasks-updated', tasks)
        }
      }
      const unsubscribe = boardSync!.onTasksChanged(listener)
      void boardSync!.getTasks().then(listener)
      return unsubscribe
    })
  })
}

export async function closeRoomFully(roomManager: RoomManager): Promise<void> {
  const room = roomManager.getCurrentRoom()
  if (room && taskLockStore) {
    await taskLockStore.releaseAllForEmployee(room.pcId).catch(() => {})
  }
  await boardSync?.stop()
  boardSync = null
  taskLockStore?.stop()
  taskLockStore = null
  await taskTypesStore?.stop()
  taskTypesStore = null
  await taskPrioritiesStore?.stop()
  taskPrioritiesStore = null
  await taskTemplatesStore?.stop()
  taskTemplatesStore = null
  taskHistoryStore = null
  reminderSettingsStore = null
  departmentMailSettingsStore = null
  departmentMailInboxStore = null
  await clearMailAttachmentPreviewCache()
  reminderScheduler?.stop()
  reminderScheduler = null
  await exchangeStore?.stop()
  exchangeStore = null
  await notesStore?.stop()
  notesStore = null
  await roomManager.closeRoom()
}

export async function autoOpenRoom(roomManager: RoomManager): Promise<Room | null> {
  const room = await roomManager.tryAutoOpen()
  if (room) await startRoomSync(room, roomManager)
  return room
}
