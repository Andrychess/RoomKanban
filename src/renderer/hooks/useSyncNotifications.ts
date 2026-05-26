import { useEffect, useState } from 'react'
import { ROOM_SYNC_SOURCE_LABELS, type RoomSyncEvent } from '../../shared/syncEvents'

export interface SyncToastMessage {
  id: number
  text: string
}

function messageForEvent(event: RoomSyncEvent): string {
  if (event.manual && event.source === 'all') {
    return 'Данные комнаты обновлены с папки синхронизации.'
  }
  if (event.merged) {
    return 'При сохранении применены более новые версии некоторых задач с диска.'
  }
  const label = ROOM_SYNC_SOURCE_LABELS[event.source]
  return `Обновлено с другого компьютера: ${label}.`
}

export function useSyncNotifications(enabled: boolean) {
  const [toast, setToast] = useState<SyncToastMessage | null>(null)

  useEffect(() => {
    if (!enabled) return

    let seq = 0
    let dismissTimer: number | undefined

    const unsub = window.api.onRoomSyncUpdated((event: RoomSyncEvent) => {
      const id = ++seq
      setToast({ id, text: messageForEvent(event) })
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer)
      dismissTimer = window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current))
      }, 5000)
    })

    return () => {
      unsub()
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer)
    }
  }, [enabled])

  return { toast, dismissToast: () => setToast(null) }
}
