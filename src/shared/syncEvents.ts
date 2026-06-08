import type { Task } from './types'

export type RoomSyncSource =
  | 'tasks'
  | 'exchange'
  | 'types'
  | 'priorities'
  | 'templates'
  | 'notes'
  | 'all'

export interface RoomSyncEvent {
  source: RoomSyncSource
  /** true — пользователь нажал «Обновить синхронизацию» */
  manual: boolean
  /** При сохранении часть задач взята с диска (более новая версия с другого ПК) */
  merged?: boolean
}

export const ROOM_SYNC_SOURCE_LABELS: Record<RoomSyncSource, string> = {
  tasks: 'задачи',
  exchange: 'обмен файлами',
  types: 'виды задач',
  priorities: 'приоритеты',
  templates: 'шаблоны',
  notes: 'заметки',
  all: 'все данные'
}

export type UpdateTaskResult =
  | { status: 'ok'; task: Task }
  | { status: 'conflict'; remoteTask: Task }
