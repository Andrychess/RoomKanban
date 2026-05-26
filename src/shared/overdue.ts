import type { Task } from './types'
import { isOverdue, daysOverdue } from './dates'
import { isActiveTask } from './tasks'

export { daysOverdue, isOverdue }

export function filterOverdueTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => isActiveTask(t) && isOverdue(t.due_date, t.status))
    .sort((a, b) => {
      const da = a.due_date ?? ''
      const db = b.due_date ?? ''
      if (da !== db) return da.localeCompare(db)
      return b.updated_at - a.updated_at
    })
}
