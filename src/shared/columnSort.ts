import type { Task, TaskType } from './types'
import { TASK_STATUSES } from './taskStatus'

function typeRank(typeId: string, order: string[]): number {
  const idx = order.indexOf(typeId)
  return idx === -1 ? order.length : idx
}

function statusRank(status: Task['status']): number {
  const idx = TASK_STATUSES.indexOf(status)
  return idx === -1 ? TASK_STATUSES.length : idx
}

/** Сортировка карточек в колонке по порядку видов задач из настроек комнаты. */
export function sortTasksInColumn(tasks: Task[], taskTypes: TaskType[]): Task[] {
  const order = taskTypes.map((type) => type.id)

  return [...tasks].sort((a, b) => {
    const typeDiff = typeRank(a.type_id, order) - typeRank(b.type_id, order)
    if (typeDiff !== 0) return typeDiff
    return b.updated_at - a.updated_at
  })
}

export function sortTasksByType(tasks: Task[], taskTypes: TaskType[]): Task[] {
  const order = taskTypes.map((type) => type.id)
  return [...tasks].sort((a, b) => {
    const typeDiff = typeRank(a.type_id, order) - typeRank(b.type_id, order)
    if (typeDiff !== 0) return typeDiff
    return b.updated_at - a.updated_at
  })
}

export function sortTasksByStatus(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff = statusRank(a.status) - statusRank(b.status)
    if (statusDiff !== 0) return statusDiff
    return b.updated_at - a.updated_at
  })
}
