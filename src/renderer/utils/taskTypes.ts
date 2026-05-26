import type { TaskPriority, TaskType } from '../../shared/types'

export function findTaskType(types: TaskType[], typeId: string): TaskType | undefined {
  return types.find((t) => t.id === typeId)
}

export function findTaskPriority(
  priorities: TaskPriority[],
  priorityId: string
): TaskPriority | undefined {
  return priorities.find((p) => p.id === priorityId)
}
