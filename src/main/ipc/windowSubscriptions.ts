import type { WebContents } from 'electron'

const subsByWindow = new Map<number, Map<string, () => void>>()
const cleanupRegistered = new Set<number>()

/**
 * Одна подписка на (окно × ключ). Повторный вызов с тем же ключом снимает предыдущую.
 */
export function setWindowSubscription(
  sender: WebContents,
  key: string,
  create: () => () => void
): void {
  const windowId = sender.id
  let map = subsByWindow.get(windowId)
  if (!map) {
    map = new Map()
    subsByWindow.set(windowId, map)
  }

  map.get(key)?.()
  map.set(key, create())

  if (!cleanupRegistered.has(windowId)) {
    cleanupRegistered.add(windowId)
    sender.once('destroyed', () => {
      cleanupRegistered.delete(windowId)
      const m = subsByWindow.get(windowId)
      if (m) {
        for (const unsub of m.values()) unsub()
        subsByWindow.delete(windowId)
      }
    })
  }
}
