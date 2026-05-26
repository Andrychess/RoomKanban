import { useMemo } from 'react'
import { filterOverdueTasks } from '../../shared/overdue'
import type { Task } from '../../shared/types'

export function useOverdueCount(tasks: Task[]): number {
  return useMemo(() => filterOverdueTasks(tasks).length, [tasks])
}
