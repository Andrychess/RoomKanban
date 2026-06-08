import { formatDueDate } from './dates'
import type { Task, TaskHistoryEntry } from './types'
import { STATUS_LABELS } from './taskStatus'

export type HistoryDraft = Omit<TaskHistoryEntry, 'id' | 'task_id' | 'at'>

function newHistoryId(): string {
  return `hist_${Math.random().toString(36).slice(2, 11)}`
}

export function buildHistoryEntries(
  prev: Task | null,
  next: Task,
  employeeKey: string,
  employeeName: string
): HistoryDraft[] {
  const base = { employee_key: employeeKey, employee_name: employeeName }
  const entries: HistoryDraft[] = []

  if (!prev) {
    entries.push({ ...base, action: 'created', detail: next.title })
    return entries
  }

  if (prev.title !== next.title) {
    entries.push({ ...base, action: 'title_changed', detail: `${prev.title} → ${next.title}` })
  }
  if (prev.description !== next.description) {
    entries.push({ ...base, action: 'description_changed' })
  }
  if (prev.status !== next.status) {
    entries.push({
      ...base,
      action: 'status_changed',
      detail: `${STATUS_LABELS[prev.status]} → ${STATUS_LABELS[next.status]}`
    })
  }
  if (prev.assignee_pc !== next.assignee_pc) {
    entries.push({ ...base, action: 'assignee_changed' })
  }
  if (prev.due_date !== next.due_date) {
    entries.push({
      ...base,
      action: 'due_date_changed',
      detail: `${formatDueDate(prev.due_date)} → ${formatDueDate(next.due_date)}`
    })
  }
  if (prev.type_id !== next.type_id) {
    entries.push({ ...base, action: 'type_changed' })
  }
  if (prev.priority_id !== next.priority_id) {
    entries.push({ ...base, action: 'priority_changed' })
  }

  const prevSource = new Set(prev.source_files.map((f) => f.id))
  const nextSource = new Set(next.source_files.map((f) => f.id))
  for (const f of next.source_files) {
    if (!prevSource.has(f.id)) {
      entries.push({ ...base, action: 'file_added', detail: `Входящие: ${f.file_name}` })
    }
  }
  for (const f of prev.source_files) {
    if (!nextSource.has(f.id)) {
      entries.push({ ...base, action: 'file_removed', detail: `Входящие: ${f.file_name}` })
    }
  }

  const prevDone = new Set(prev.completed_files.map((f) => f.id))
  const nextDone = new Set(next.completed_files.map((f) => f.id))
  for (const f of next.completed_files) {
    if (!prevDone.has(f.id)) {
      entries.push({ ...base, action: 'file_added', detail: `Итог: ${f.file_name}` })
    }
  }
  for (const f of prev.completed_files) {
    if (!nextDone.has(f.id)) {
      entries.push({ ...base, action: 'file_removed', detail: `Итог: ${f.file_name}` })
    }
  }

  if (!prev.archived_at && next.archived_at) {
    entries.push({ ...base, action: 'archived' })
  }
  if (prev.archived_at && !next.archived_at) {
    entries.push({ ...base, action: 'restored' })
  }

  return entries
}

export function toHistoryEntry(taskId: string, draft: HistoryDraft): TaskHistoryEntry {
  return {
    id: newHistoryId(),
    task_id: taskId,
    at: Math.floor(Date.now() / 1000),
    ...draft
  }
}

export const HISTORY_ACTION_LABELS: Record<TaskHistoryEntry['action'], string> = {
  created: 'Создана задача',
  title_changed: 'Изменено название',
  description_changed: 'Изменено описание',
  status_changed: 'Смена этапа',
  assignee_changed: 'Смена ответственного',
  due_date_changed: 'Изменён срок',
  type_changed: 'Изменён вид задачи',
  priority_changed: 'Изменён приоритет',
  file_added: 'Добавлен файл',
  file_removed: 'Удалён файл',
  comment_added: 'Новый комментарий',
  checklist_changed: 'Изменён чек-лист',
  archived: 'В архиве',
  restored: 'Восстановлена из архива'
}
