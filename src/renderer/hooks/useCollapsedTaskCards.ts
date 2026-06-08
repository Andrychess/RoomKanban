import { useCallback, useState } from 'react'

function storageKey(roomPath: string): string {
  return `roomKanban:expandedCards:${roomPath}`
}

function readExpandedIds(roomPath: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(storageKey(roomPath))
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as string[]
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

function saveExpandedIds(roomPath: string, ids: Set<string>): void {
  sessionStorage.setItem(storageKey(roomPath), JSON.stringify([...ids]))
}

export function useCollapsedTaskCards(roomPath: string) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => readExpandedIds(roomPath))

  const isTaskCollapsed = useCallback(
    (taskId: string) => !expandedIds.has(taskId),
    [expandedIds]
  )

  const toggleTaskCollapsed = useCallback(
    (taskId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(taskId)) next.delete(taskId)
        else next.add(taskId)
        saveExpandedIds(roomPath, next)
        return next
      })
    },
    [roomPath]
  )

  return { isTaskCollapsed, toggleTaskCollapsed }
}
