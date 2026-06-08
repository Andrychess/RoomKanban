import { useMemo, useState } from 'react'
import type { RoomState, Task } from '../../shared/types'
import { taskMatchesSearch } from '../../shared/taskSearch'

export const OWNERSHIP_PRESETS = ['all', 'mine', 'not_mine'] as const
export type OwnershipPreset = (typeof OWNERSHIP_PRESETS)[number]

/** «all» | «mine» | «not_mine» или ключ сотрудника (pcId). */
export type OwnershipFilter = OwnershipPreset | string

function matchesOwnership(
  task: Task,
  filter: OwnershipFilter,
  myEmployeeKey: string
): boolean {
  if (filter === 'all') return true
  if (filter === 'mine') return task.assignee_pc === myEmployeeKey
  if (filter === 'not_mine') return task.assignee_pc !== myEmployeeKey
  return task.assignee_pc === filter
}

export interface KanbanTaskFilters {
  typeId: string
  ownership: OwnershipFilter
  query: string
}

const DEFAULT_FILTERS: KanbanTaskFilters = {
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
    filters.typeId !== 'all' ||
    filters.ownership !== 'all' ||
    filters.query.trim().length > 0

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.typeId !== 'all' && task.type_id !== filters.typeId) {
        return false
      }
      if (!matchesOwnership(task, filters.ownership, myEmployeeKey)) {
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
