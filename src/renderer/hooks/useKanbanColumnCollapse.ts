import { useCallback, useEffect, useState } from 'react'
import { defaultColumnCollapsed } from '../../shared/kanbanColumnCollapse'
import type { TaskStatus } from '../../shared/taskStatus'

export function useKanbanColumnCollapse(roomPath: string) {
  const [collapsed, setCollapsed] = useState<Record<TaskStatus, boolean>>(() =>
    defaultColumnCollapsed()
  )

  useEffect(() => {
    void window.api.getColumnCollapsed(roomPath).then(setCollapsed)
  }, [roomPath])

  const setColumnCollapsed = useCallback(
    async (column: TaskStatus, isCollapsed: boolean) => {
      const next = await window.api.setColumnCollapsed(roomPath, column, isCollapsed)
      setCollapsed(next)
    },
    [roomPath]
  )

  const toggleColumnCollapsed = useCallback(
    (column: TaskStatus) => {
      void setColumnCollapsed(column, !collapsed[column])
    },
    [collapsed, setColumnCollapsed]
  )

  const expandColumn = useCallback(
    (column: TaskStatus) => {
      if (collapsed[column]) void setColumnCollapsed(column, false)
    },
    [collapsed, setColumnCollapsed]
  )

  return { collapsed, setColumnCollapsed, toggleColumnCollapsed, expandColumn }
}
