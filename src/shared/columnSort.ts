import { parseDueDate } from './dates'
import { isTaskOverdue } from './overdue'
import type { Task, TaskPriority } from './types'
import type { TaskStatus } from './taskStatus'

export type ColumnSortId =
  | 'newest'
  | 'oldest'
  | 'due_soon'
  | 'due_late'
  | 'priority_high'
  | 'title_asc'

export const COLUMN_SORT_OPTIONS: { id: ColumnSortId; label: string }[] = [
  { id: 'newest', label: 'Сначала новые' },
  { id: 'oldest', label: 'Сначала старые' },
  { id: 'due_soon', label: 'Срок: ближайшие' },
  { id: 'due_late', label: 'Срок: просроченные' },
  { id: 'priority_high', label: 'Срочность выше' },
  { id: 'title_asc', label: 'По названию А–Я' }
]

export const DEFAULT_COLUMN_SORT: ColumnSortId = 'newest'

export function defaultColumnSorts(): Record<TaskStatus, ColumnSortId> {
  return {
    review: DEFAULT_COLUMN_SORT,
    todo: DEFAULT_COLUMN_SORT,
    in_progress: DEFAULT_COLUMN_SORT,
    done: DEFAULT_COLUMN_SORT
  }
}

function priorityRank(priorityId: string, order: string[]): number {
  const idx = order.indexOf(priorityId)
  return idx === -1 ? order.length : idx
}

function dueSortKey(due: string | null, asc: boolean): number {
  if (!due) return asc ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER
  const parsed = parseDueDate(due)
  const t = parsed?.getTime() ?? 0
  return asc ? t : -t
}

export function sortTasksInColumn(
  tasks: Task[],
  sortId: ColumnSortId,
  priorityOrder: TaskPriority[]
): Task[] {
  const order = priorityOrder.map((p) => p.id)
  const list = [...tasks]

  list.sort((a, b) => {
    switch (sortId) {
      case 'oldest':
        return a.created_at - b.created_at
      case 'due_soon':
        return dueSortKey(a.due_date, true) - dueSortKey(b.due_date, true)
      case 'due_late': {
        const aLate = isTaskOverdue(a) ? 0 : 1
        const bLate = isTaskOverdue(b) ? 0 : 1
        if (aLate !== bLate) return aLate - bLate
        const ka = dueSortKey(a.due_date, false)
        const kb = dueSortKey(b.due_date, false)
        if (ka !== kb) return ka - kb
        return b.updated_at - a.updated_at
      }
      case 'priority_high': {
        const pa = priorityRank(a.priority_id, order)
        const pb = priorityRank(b.priority_id, order)
        if (pa !== pb) return pb - pa
        return b.updated_at - a.updated_at
      }
      case 'title_asc':
        return a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' })
      case 'newest':
      default:
        return b.updated_at - a.updated_at
    }
  })

  return list
}
