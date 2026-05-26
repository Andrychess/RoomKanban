import { useCallback, useEffect, useState } from 'react'
import type { ColumnSortId } from '../../shared/columnSort'
import { defaultColumnSorts } from '../../shared/columnSort'
import type { TaskStatus } from '../../shared/taskStatus'

export function useKanbanColumnSort(roomPath: string) {
  const [sorts, setSorts] = useState<Record<TaskStatus, ColumnSortId>>(() =>
    defaultColumnSorts()
  )

  useEffect(() => {
    void window.api.getColumnSorts(roomPath).then(setSorts)
  }, [roomPath])

  const setColumnSort = useCallback(
    async (column: TaskStatus, sortId: ColumnSortId) => {
      const next = await window.api.setColumnSort(roomPath, column, sortId)
      setSorts(next)
    },
    [roomPath]
  )

  return { sorts, setColumnSort }
}
