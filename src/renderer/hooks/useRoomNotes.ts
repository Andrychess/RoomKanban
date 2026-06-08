import { useCallback, useEffect, useState } from 'react'
import type { RoomNote } from '../../shared/types'
import { useRoomDataRefresh } from './useRoomDataRefresh'

export function useRoomNotes() {
  const [notes, setNotes] = useState<RoomNote[]>([])

  const refresh = useCallback(() => {
    void window.api.getRoomNotes().then(setNotes).catch(() => setNotes([]))
  }, [])

  useEffect(() => {
    refresh()
    return window.api.subscribeRoomNotes(setNotes)
  }, [refresh])

  useRoomDataRefresh(refresh, true)

  return { notes, refresh }
}
