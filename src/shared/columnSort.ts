import type { Task, TaskType } from './types'

function typeRank(typeId: string, order: string[]): number {
  const idx = order.indexOf(typeId)
  return idx === -1 ? order.length : idx
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
