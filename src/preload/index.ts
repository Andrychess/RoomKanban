import { contextBridge, ipcRenderer } from 'electron'
import type { ChiefDashboardData } from '../shared/chiefDashboard'
import type {
  AppTheme,
  CreateTaskInput,
  EnterRoomCredentials,
  ReminderSettings,
  Room,
  RoomEntryInfo,
  RoomNote,
  RoomState,
  RoomsSyncSummary,
  Task,
  TaskFile,
  TaskFileKind,
  TaskHistoryEntry,
  TaskLockResult,
  TaskType,
  UpdateTaskInput
} from '../shared/types'
import type { TaskStatus } from '../shared/taskStatus'
import type { DocumentationBundle } from '../shared/documentation'
import type { RoomSyncEvent, UpdateTaskResult } from '../shared/syncEvents'
import type { AppUpdateStatus } from '../shared/appUpdate'

export interface RoomKanbanApi {
  getUserDocumentation: () => Promise<DocumentationBundle>
  getAppTheme: () => Promise<AppTheme>
  setAppTheme: (theme: AppTheme) => Promise<AppTheme>
  selectFolder: () => Promise<string | null>
  selectTaskFiles: () => Promise<string[]>
  createRoom: (
    folderPath: string,
    roomName: string,
    userName: string,
    userRole: string,
    roomPassword?: string,
    chiefPassword?: string
  ) => Promise<Room>
  resolveRoomEntry: (folderPath: string) => Promise<RoomEntryInfo>
  enterRoom: (
    folderPath: string,
    employeeKey: string,
    credentials?: EnterRoomCredentials
  ) => Promise<Room>
  verifyRoomPassword: (folderPath: string, password: string) => Promise<boolean>
  setRoomPassword: (password: string | null) => Promise<Room>
  setEmployeePassword: (employeeKey: string, password: string | null) => Promise<Room>
  getColumnCollapsed: (roomPath: string) => Promise<Record<TaskStatus, boolean>>
  setColumnCollapsed: (
    roomPath: string,
    column: TaskStatus,
    collapsed: boolean
  ) => Promise<Record<TaskStatus, boolean>>
  addEmployee: (name: string, role: string) => Promise<Room>
  updateEmployee: (employeeKey: string, name: string, role: string) => Promise<Room>
  removeEmployee: (employeeKey: string) => Promise<Room>
  peekRoom: (folderPath: string) => Promise<RoomState>
  getCurrentRoom: () => Promise<Room | null>
  getRecentRooms: () => Promise<string[]>
  listRooms: () => Promise<RoomsSyncSummary>
  getActiveEmployeeKey: () => Promise<string | null>
  closeRoom: () => Promise<void>
  getTaskTypes: () => Promise<TaskType[]>
  saveTaskTypes: (types: TaskType[]) => Promise<TaskType[]>
  subscribeTaskTypes: (callback: (types: TaskType[]) => void) => () => void
  getTasks: () => Promise<Task[]>
  createTask: (input: CreateTaskInput) => Promise<Task>
  seedTestTasks: () => Promise<{ count: number }>
  updateTask: (input: UpdateTaskInput) => Promise<UpdateTaskResult>
  refreshRoomSync: () => Promise<{ refreshed_at: number }>
  onRoomSyncUpdated: (callback: (event: RoomSyncEvent) => void) => () => void
  onRoomDataRefreshed: (callback: () => void) => () => void
  updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>
  updateTaskAssignee: (taskId: string, assigneePc: string) => Promise<void>
  clearDoneTasks: () => Promise<number>
  archiveDoneTasks: () => Promise<number>
  getArchivedTasks: () => Promise<Task[]>
  restoreArchivedTask: (taskId: string) => Promise<Task>
  deleteTask: (taskId: string) => Promise<void>
  deleteArchivedTask: (taskId: string) => Promise<void>
  getTaskHistory: (taskId: string) => Promise<TaskHistoryEntry[]>
  getChiefDashboard: () => Promise<ChiefDashboardData>
  getRoomNotes: () => Promise<RoomNote[]>
  addRoomNote: (title: string, text: string) => Promise<RoomNote>
  updateRoomNote: (noteId: string, title: string, text: string) => Promise<RoomNote>
  deleteRoomNote: (noteId: string) => Promise<void>
  subscribeRoomNotes: (callback: (notes: RoomNote[]) => void) => () => void
  getReminderSettings: () => Promise<ReminderSettings>
  saveReminderSettings: (settings: ReminderSettings) => Promise<ReminderSettings>
  getOverdueTasks: () => Promise<Task[]>
  acquireTaskLock: (taskId: string) => Promise<TaskLockResult>
  releaseTaskLock: (taskId: string) => Promise<void>
  refreshTaskLock: (taskId: string) => Promise<boolean>
  openTaskFile: (taskId: string, kind: TaskFileKind, fileId: string) => Promise<void>
  subscribeTasks: (callback: (tasks: Task[]) => void) => () => void
  getExchangeFiles: () => Promise<Record<string, TaskFile[]>>
  addExchangeFiles: (employeeKey: string, paths: string[]) => Promise<TaskFile[]>
  clearExchangeFiles: (employeeKey: string) => Promise<number>
  removeExchangeFile: (employeeKey: string, fileId: string) => Promise<void>
  openExchangeFile: (employeeKey: string, fileId: string) => Promise<void>
  subscribeExchange: (callback: (files: Record<string, TaskFile[]>) => void) => () => void
  onNavigate: (callback: (screen: string) => void) => () => void
  onOpenHelp: (callback: (anchor: string | null) => void) => () => void
  onRoomAutoOpened: (callback: (room: Room) => void) => () => void
  onRoomClosed: (callback: () => void) => () => void
  getAppUpdateStatus: () => Promise<AppUpdateStatus>
  isAppUpdateEnabled: () => Promise<boolean>
  startAppUpdate: () => Promise<AppUpdateStatus>
  onAppUpdateStatus: (callback: (status: AppUpdateStatus) => void) => () => void
  onOpenAppUpdate: (callback: () => void) => () => void
}

const api: RoomKanbanApi = {
  getUserDocumentation: () => ipcRenderer.invoke('get-user-documentation'),
  getAppTheme: () => ipcRenderer.invoke('get-app-theme'),
  setAppTheme: (theme) => ipcRenderer.invoke('set-app-theme', theme),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectTaskFiles: () => ipcRenderer.invoke('select-task-files'),
  createRoom: (folderPath, roomName, userName, userRole, roomPassword, chiefPassword) =>
    ipcRenderer.invoke(
      'create-room',
      folderPath,
      roomName,
      userName,
      userRole,
      roomPassword,
      chiefPassword
    ),
  resolveRoomEntry: (folderPath) => ipcRenderer.invoke('resolve-room-entry', folderPath),
  enterRoom: (folderPath, employeeKey, credentials) =>
    ipcRenderer.invoke('enter-room', folderPath, employeeKey, credentials ?? {}),
  verifyRoomPassword: (folderPath, password) =>
    ipcRenderer.invoke('verify-room-password', folderPath, password),
  setRoomPassword: (password) => ipcRenderer.invoke('set-room-password', password),
  setEmployeePassword: (employeeKey, password) =>
    ipcRenderer.invoke('set-employee-password', employeeKey, password),
  getColumnCollapsed: (roomPath) => ipcRenderer.invoke('get-column-collapsed', roomPath),
  setColumnCollapsed: (roomPath, column, collapsed) =>
    ipcRenderer.invoke('set-column-collapsed', roomPath, column, collapsed),
  addEmployee: (name, role) => ipcRenderer.invoke('add-employee', name, role),
  updateEmployee: (employeeKey, name, role) =>
    ipcRenderer.invoke('update-employee', employeeKey, name, role),
  removeEmployee: (employeeKey) => ipcRenderer.invoke('remove-employee', employeeKey),
  peekRoom: (folderPath) => ipcRenderer.invoke('peek-room', folderPath),
  getCurrentRoom: () => ipcRenderer.invoke('get-current-room'),
  getRecentRooms: () => ipcRenderer.invoke('get-recent-rooms'),
  listRooms: () => ipcRenderer.invoke('list-rooms'),
  getActiveEmployeeKey: () => ipcRenderer.invoke('get-active-employee-key'),
  closeRoom: () => ipcRenderer.invoke('close-room'),
  getTaskTypes: () => ipcRenderer.invoke('get-task-types'),
  saveTaskTypes: (types) => ipcRenderer.invoke('save-task-types', types),
  subscribeTaskTypes: (callback) => {
    const handler = (_: unknown, types: TaskType[]) => callback(types)
    ipcRenderer.on('task-types-updated', handler)
    void ipcRenderer.invoke('subscribe-task-types')
    return () => ipcRenderer.removeListener('task-types-updated', handler)
  },
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  createTask: (input) => ipcRenderer.invoke('create-task', input),
  seedTestTasks: () => ipcRenderer.invoke('seed-test-tasks'),
  updateTask: (input) => ipcRenderer.invoke('update-task', input),
  refreshRoomSync: () => ipcRenderer.invoke('refresh-room-sync'),
  onRoomSyncUpdated: (callback) => {
    const handler = (_: unknown, event: RoomSyncEvent) => callback(event)
    ipcRenderer.on('room-sync-updated', handler)
    return () => ipcRenderer.removeListener('room-sync-updated', handler)
  },
  onRoomDataRefreshed: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('room-data-refreshed', handler)
    return () => ipcRenderer.removeListener('room-data-refreshed', handler)
  },
  updateTaskStatus: (taskId, status) =>
    ipcRenderer.invoke('update-task-status', taskId, status),
  updateTaskAssignee: (taskId, assigneePc) =>
    ipcRenderer.invoke('update-task-assignee', taskId, assigneePc),
  clearDoneTasks: () => ipcRenderer.invoke('clear-done-tasks'),
  archiveDoneTasks: () => ipcRenderer.invoke('archive-done-tasks'),
  getArchivedTasks: () => ipcRenderer.invoke('get-archived-tasks'),
  restoreArchivedTask: (taskId) => ipcRenderer.invoke('restore-archived-task', taskId),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  deleteArchivedTask: (taskId) => ipcRenderer.invoke('delete-archived-task', taskId),
  getTaskHistory: (taskId) => ipcRenderer.invoke('get-task-history', taskId),
  getChiefDashboard: () => ipcRenderer.invoke('get-chief-dashboard'),
  getRoomNotes: () => ipcRenderer.invoke('get-room-notes'),
  addRoomNote: (title, text) => ipcRenderer.invoke('add-room-note', title, text),
  updateRoomNote: (noteId, title, text) =>
    ipcRenderer.invoke('update-room-note', noteId, title, text),
  deleteRoomNote: (noteId) => ipcRenderer.invoke('delete-room-note', noteId),
  subscribeRoomNotes: (callback) => {
    const handler = (_: unknown, notes: RoomNote[]) => callback(notes)
    ipcRenderer.on('room-notes-updated', handler)
    void ipcRenderer.invoke('subscribe-room-notes')
    return () => ipcRenderer.removeListener('room-notes-updated', handler)
  },
  getReminderSettings: () => ipcRenderer.invoke('get-reminder-settings'),
  saveReminderSettings: (settings) => ipcRenderer.invoke('save-reminder-settings', settings),
  getOverdueTasks: () => ipcRenderer.invoke('get-overdue-tasks'),
  acquireTaskLock: (taskId) => ipcRenderer.invoke('acquire-task-lock', taskId),
  releaseTaskLock: (taskId) => ipcRenderer.invoke('release-task-lock', taskId),
  refreshTaskLock: (taskId) => ipcRenderer.invoke('refresh-task-lock', taskId),
  openTaskFile: (taskId, kind, fileId) =>
    ipcRenderer.invoke('open-task-file', taskId, kind, fileId),
  subscribeTasks: (callback) => {
    const handler = (_: unknown, tasks: Task[]) => callback(tasks)
    ipcRenderer.on('tasks-updated', handler)
    void ipcRenderer.invoke('subscribe-tasks')
    return () => ipcRenderer.removeListener('tasks-updated', handler)
  },
  getExchangeFiles: () => ipcRenderer.invoke('get-exchange-files'),
  addExchangeFiles: (employeeKey, paths) =>
    ipcRenderer.invoke('add-exchange-files', employeeKey, paths),
  clearExchangeFiles: (employeeKey) => ipcRenderer.invoke('clear-exchange-files', employeeKey),
  removeExchangeFile: (employeeKey, fileId) =>
    ipcRenderer.invoke('remove-exchange-file', employeeKey, fileId),
  openExchangeFile: (employeeKey, fileId) =>
    ipcRenderer.invoke('open-exchange-file', employeeKey, fileId),
  subscribeExchange: (callback) => {
    const handler = (_: unknown, files: Record<string, TaskFile[]>) => callback(files)
    ipcRenderer.on('exchange-updated', handler)
    void ipcRenderer.invoke('subscribe-exchange')
    return () => ipcRenderer.removeListener('exchange-updated', handler)
  },
  onNavigate: (callback) => {
    const handler = (_: unknown, screen: string) => callback(screen)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  },
  onOpenHelp: (callback) => {
    const handler = (_: unknown, anchor: string | null) => callback(anchor)
    ipcRenderer.on('open-help', handler)
    return () => ipcRenderer.removeListener('open-help', handler)
  },
  onRoomAutoOpened: (callback) => {
    const handler = (_: unknown, room: Room) => callback(room)
    ipcRenderer.on('room-auto-opened', handler)
    return () => ipcRenderer.removeListener('room-auto-opened', handler)
  },
  onRoomClosed: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('room-closed', handler)
    return () => ipcRenderer.removeListener('room-closed', handler)
  },
  getAppUpdateStatus: () => ipcRenderer.invoke('get-app-update-status'),
  isAppUpdateEnabled: () => ipcRenderer.invoke('is-app-update-enabled'),
  startAppUpdate: () => ipcRenderer.invoke('start-app-update'),
  onAppUpdateStatus: (callback) => {
    const handler = (_: unknown, status: AppUpdateStatus) => callback(status)
    ipcRenderer.on('app-update-status', handler)
    return () => ipcRenderer.removeListener('app-update-status', handler)
  },
  onOpenAppUpdate: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('open-app-update', handler)
    return () => ipcRenderer.removeListener('open-app-update', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
