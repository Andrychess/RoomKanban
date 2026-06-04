import { useEffect } from 'react'

/** Перечитать данные после «Обновить синхронизацию» в панели комнаты. */
export function useRoomDataRefresh(onRefresh: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    return window.api.onRoomDataRefreshed(onRefresh)
  }, [enabled, onRefresh])
}
