import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'roomKanban:employeeKanbanColumnCollapsed'

function readCollapsed(roomPath: string): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const map = JSON.parse(raw) as Record<string, Record<string, boolean>>
    return map[roomPath] ?? {}
  } catch {
    return {}
  }
}

function saveCollapsed(roomPath: string, columnId: string, collapsed: boolean): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {}
    if (!map[roomPath]) map[roomPath] = {}
    if (collapsed) map[roomPath][columnId] = true
    else delete map[roomPath][columnId]
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function useEmployeeKanbanColumnCollapse(roomPath: string) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readCollapsed(roomPath))

  useEffect(() => {
    setCollapsed(readCollapsed(roomPath))
  }, [roomPath])

  const setColumnCollapsed = useCallback(
    (columnId: string, isCollapsed: boolean) => {
      setCollapsed((prev) => {
        const next = { ...prev }
        if (isCollapsed) next[columnId] = true
        else delete next[columnId]
        saveCollapsed(roomPath, columnId, isCollapsed)
        return next
      })
    },
    [roomPath]
  )

  const toggleColumnCollapsed = useCallback(
    (columnId: string) => {
      setColumnCollapsed(columnId, !collapsed[columnId])
    },
    [collapsed, setColumnCollapsed]
  )

  const expandColumn = useCallback(
    (columnId: string) => {
      if (collapsed[columnId]) setColumnCollapsed(columnId, false)
    },
    [collapsed, setColumnCollapsed]
  )

  return { collapsed, toggleColumnCollapsed, expandColumn }
}
