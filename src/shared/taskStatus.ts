import type { Task } from './types'

export const TASK_STATUSES = ['review', 'todo', 'in_progress', 'done'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Подписи для колонок и выбора статуса */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  review: 'Входящие',
  todo: 'В очереди',
  in_progress: 'В работе',
  done: 'Готово'
}

/** Полные названия (редактор, подсказки) */
export const STATUS_LABELS_FULL: Record<TaskStatus, string> = {
  review: 'На рассмотрении',
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Выполнено'
}

export const KANBAN_COLUMNS: { id: TaskStatus; title: string }[] = TASK_STATUSES.map((id) => ({
  id,
  title: STATUS_LABELS[id]
}))

export const COLUMN_THEMES: Record<
  TaskStatus,
  { accent: string; surface: string; header: string }
> = {
  review: {
    accent: '#a78bfa',
    surface: 'rgba(139, 92, 246, 0.07)',
    header: 'rgba(139, 92, 246, 0.18)'
  },
  todo: {
    accent: '#94a3b8',
    surface: 'rgba(148, 163, 184, 0.06)',
    header: 'rgba(148, 163, 184, 0.14)'
  },
  in_progress: {
    accent: '#fbbf24',
    surface: 'rgba(251, 191, 36, 0.08)',
    header: 'rgba(251, 191, 36, 0.16)'
  },
  done: {
    accent: '#4ade80',
    surface: 'rgba(74, 222, 128, 0.08)',
    header: 'rgba(74, 222, 128, 0.16)'
  }
}

/** Проверка статуса при чтении старых данных */
export function parseTaskStatus(raw: unknown): Task['status'] {
  if (typeof raw === 'string' && TASK_STATUSES.includes(raw as TaskStatus)) {
    return raw as Task['status']
  }
  return 'todo'
}
