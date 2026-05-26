import { useMemo, useState } from 'react'
import type { RoomState, Task } from '../../shared/types'
import { taskMatchesSearch } from '../../shared/taskSearch'

export type OwnershipFilter = 'all' | 'mine' | 'not_mine'

export interface KanbanTaskFilters {
  priorityId: string
  typeId: string
  ownership: OwnershipFilter
  query: string
}

const DEFAULT_FILTERS: KanbanTaskFilters = {
  priorityId: 'all',
  typeId: 'all',
  ownership: 'all',
  query: ''
}

export function useKanbanTaskFilters(
  tasks: Task[],
  myEmployeeKey: string,
  employees: RoomState['employees']
) {
  const [filters, setFilters] = useState<KanbanTaskFilters>(DEFAULT_FILTERS)

  const hasActiveFilters =
    filters.priorityId !== 'all' ||
    filters.typeId !== 'all' ||
    filters.ownership !== 'all' ||
    filters.query.trim().length > 0

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.priorityId !== 'all' && task.priority_id !== filters.priorityId) {
        return false
      }
      if (filters.typeId !== 'all' && task.type_id !== filters.typeId) {
        return false
      }
      if (filters.ownership === 'mine' && task.assignee_pc !== myEmployeeKey) {
        return false
      }
      if (filters.ownership === 'not_mine' && task.assignee_pc === myEmployeeKey) {
        return false
      }
      if (!taskMatchesSearch(task, filters.query, employees)) {
        return false
      }
      return true
    })
  }, [tasks, filters, myEmployeeKey, employees])

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  return {
    filters,
    setFilters,
    filteredTasks,
    hasActiveFilters,
    resetFilters
  }
}
