import type { Task } from './types'

export function isActiveTask(task: Task): boolean {
  return task.archived_at == null
}

export function isArchivedTask(task: Task): boolean {
  return task.archived_at != null
}
