import { useCallback, useEffect, useState } from 'react'

export function useBoardColumnCollapse(roomPath: string, storageKey: string) {
  function readCollapsed(): Record<string, boolean> {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return {}
      const map = JSON.parse(raw) as Record<string, Record<string, boolean>>
      return map[roomPath] ?? {}
    } catch {
      return {}
    }
  }

  function saveCollapsed(columnId: string, collapsed: boolean): void {
    try {
      const raw = sessionStorage.getItem(storageKey)
      const map = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {}
      if (!map[roomPath]) map[roomPath] = {}
      if (collapsed) map[roomPath][columnId] = true
      else delete map[roomPath][columnId]
      sessionStorage.setItem(storageKey, JSON.stringify(map))
    } catch {
      /* ignore */
    }
  }

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readCollapsed())

  useEffect(() => {
    setCollapsed(readCollapsed())
  }, [roomPath, storageKey])

  const setColumnCollapsed = useCallback(
    (columnId: string, isCollapsed: boolean) => {
      setCollapsed((prev) => {
        const next = { ...prev }
        if (isCollapsed) next[columnId] = true
        else delete next[columnId]
        saveCollapsed(columnId, isCollapsed)
        return next
      })
    },
    [roomPath, storageKey]
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
