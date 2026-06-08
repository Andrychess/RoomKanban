import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'roomKanban:notesPanelCollapsed'

function readCollapsed(roomPath: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const map = JSON.parse(raw) as Record<string, boolean>
    return Boolean(map[roomPath])
  } catch {
    return false
  }
}

function saveCollapsed(roomPath: string, collapsed: boolean): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    if (collapsed) map[roomPath] = true
    else delete map[roomPath]
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function useNotesPanelCollapsed(roomPath: string) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(roomPath))

  useEffect(() => {
    setCollapsed(readCollapsed(roomPath))
  }, [roomPath])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      saveCollapsed(roomPath, next)
      return next
    })
  }, [roomPath])

  const setCollapsedPersisted = useCallback((next: boolean) => {
    setCollapsed(next)
    saveCollapsed(roomPath, next)
  }, [roomPath])

  return { collapsed, toggleCollapsed, setCollapsed: setCollapsedPersisted }
}
