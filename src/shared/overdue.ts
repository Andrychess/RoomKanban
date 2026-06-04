import type { Task } from './types'
import { isOverdue, daysOverdue } from './dates'
import { isActiveTask } from './tasks'

export { daysOverdue, isOverdue }

/** Просрочена ли активная задача (не в колонке «Готово»). */
export function isTaskOverdue(task: Pick<Task, 'due_date' | 'status'>): boolean {
  return isOverdue(task.due_date, task.status)
}

export function filterOverdueTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => isActiveTask(t) && isTaskOverdue(t))
    .sort((a, b) => {
      const da = a.due_date ?? ''
      const db = b.due_date ?? ''
      if (da !== db) return da.localeCompare(db)
      return b.updated_at - a.updated_at
    })
}
