import type { ColumnSortId } from './columnSort'
import type { TaskStatus } from './taskStatus'

export interface PasswordSecret {
  salt: string
  hash: string
}

export interface Employee {
  name: string
  role: string
  joined_at: number
  /** Необязательный пароль учётной записи */
  password?: PasswordSecret
}

export interface EmployeeProfile {
  key: string
  name: string
  role: string
  isChief: boolean
  hasPassword: boolean
}

export interface RoomEntryInfo {
  folderPath: string
  roomName: string
  inviteCode: string
  createdAt: number
  employees: EmployeeProfile[]
  /** Последний выбранный профиль на этом ПК */
  lastUsedEmployeeKey: string | null
  requiresRoomPassword: boolean
}

export interface RoomState {
  room_id: string
  room_name: string
  invite_code: string
  created_at: number
  chief_pc: string
  employees: Record<string, Employee>
  /** Необязательный пароль на вход в комнату */
  room_password?: PasswordSecret
}

export interface EnterRoomCredentials {
  roomPassword?: string
  employeePassword?: string
}

export interface TaskLockHolder {
  employee_key: string
  employee_name: string
  since: number
}

export interface TaskLockResult {
  acquired: boolean
  holder: TaskLockHolder | null
}

export interface TaskType {
  id: string
  name: string
  /** HEX, например #3b82f6 */
  color: string
}

export interface TaskTypesData {
  types: TaskType[]
  updated_at: number
}

/** Тег приоритета (настраивается начальником) */
export interface TaskPriority {
  id: string
  name: string
  color: string
}

export interface TaskPrioritiesData {
  priorities: TaskPriority[]
  updated_at: number
}

export type TaskFileKind = 'source' | 'completed'

export interface TaskFile {
  id: string
  file_name: string
  file_rel: string
  added_at: number
}

export interface TaskComment {
  id: string
  author_pc: string
  author_name: string
  text: string
  created_at: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export type TaskHistoryAction =
  | 'created'
  | 'title_changed'
  | 'description_changed'
  | 'status_changed'
  | 'assignee_changed'
  | 'due_date_changed'
  | 'type_changed'
  | 'priority_changed'
  | 'file_added'
  | 'file_removed'
  | 'comment_added'
  | 'checklist_changed'
  | 'archived'
  | 'restored'

export interface TaskHistoryEntry {
  id: string
  task_id: string
  employee_key: string
  employee_name: string
  action: TaskHistoryAction
  detail?: string
  at: number
}

export interface TaskHistoryData {
  entries: TaskHistoryEntry[]
  updated_at: number
}

export interface TaskTemplate {
  id: string
  name: string
  title: string
  description: string
  type_id: string
  priority_id: string
  /** Срок = сегодня + N дней */
  due_days_offset: number
  status: Task['status']
  checklist: ChecklistItem[]
}

export interface TaskTemplatesData {
  templates: TaskTemplate[]
  updated_at: number
}

export interface ReminderSettings {
  /** За сколько дней до срока напоминать (например [1, 3]) */
  days_before: number[]
  notify_assignee: boolean
  notify_chief: boolean
  updated_at: number
}

export interface Task {
  id: string
  title: string
  /** Описание / ТЗ задачи */
  description: string
  status: 'review' | 'todo' | 'in_progress' | 'done'
  /** Вид задачи — id из task_types.json */
  type_id: string
  /** Приоритет — id из task_priorities.json */
  priority_id: string
  assignee_pc: string
  /** Срок выполнения, YYYY-MM-DD */
  due_date: string | null
  /** Входящие материалы (письмо и т.п.) */
  source_files: TaskFile[]
  /** Итоговые документы после выполнения (приказ и т.п.) */
  completed_files: TaskFile[]
  comments: TaskComment[]
  checklist: ChecklistItem[]
  /** Unix sec; null — на доске */
  archived_at: number | null
  created_by_pc: string
  created_at: number
  updated_at: number
}

export interface BoardData {
  tasks: Task[]
  updated_at: number
}

/** @deprecated Используется только при создании комнаты; задачи — в board.json */
export interface PcSyncData {
  pc_id: string
  tasks: Task[]
  updated_at: number
}

export interface CreateTaskInput {
  title: string
  description: string
  assignee_pc: string
  type_id: string
  priority_id: string
  due_date?: string | null
  status?: Task['status']
  checklist?: ChecklistItem[]
  add_source_files?: string[]
  add_completed_files?: string[]
}

export interface UpdateTaskInput {
  id: string
  title: string
  description: string
  assignee_pc: string
  type_id: string
  priority_id: string
  due_date?: string | null
  status: Task['status']
  checklist?: ChecklistItem[]
  /** updated_at задачи при открытии редактора — для проверки конфликта */
  client_base_updated_at?: number
  /** Сохранить, даже если на диске уже есть более новая версия */
  force_overwrite?: boolean
  add_source_files?: string[]
  add_completed_files?: string[]
  remove_source_file_ids?: string[]
  remove_completed_file_ids?: string[]
}

export interface Room {
  path: string
  state: RoomState
  pcId: string
  isChief: boolean
}

export type AppTheme = 'light' | 'dark'

export interface ExchangeData {
  /** employee_key → файлы в «окне» сотрудника */
  files: Record<string, TaskFile[]>
  updated_at: number
}

export interface AppSettings {
  theme?: AppTheme
  currentRoomPath: string | null
  lastOpenedRooms: string[]
  /** Стабильный цифровой след этого ПК */
  machineFingerprint: string
  /** Последний выбранный профиль сотрудника для папки комнаты */
  employeeBindings: Record<string, string>
  /** Сортировка задач в колонках канбана по пути комнаты */
  kanbanColumnSort?: Record<string, Partial<Record<TaskStatus, ColumnSortId>>>
  /** Отправленные напоминания: roomPath → taskId:dueDate:kind → timestamp */
  reminderSent?: Record<string, Record<string, number>>
  /** @deprecated миграция со старых версий */
  pcId?: string
}

export type RoomSyncStatus = 'synced' | 'unavailable' | 'not_found' | 'invalid'

export interface RoomListItem {
  path: string
  room_name: string | null
  invite_code: string | null
  created_at: number | null
  last_sync_at: number | null
  task_count: number
  employee_count: number
  status: RoomSyncStatus
  is_current: boolean
}

export interface RoomsSyncSummary {
  rooms: RoomListItem[]
  all_synced: boolean
  available_count: number
  checked_at: number
}
