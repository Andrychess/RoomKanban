import { useCallback, useEffect, useState } from 'react'
import type { TaskType } from '../../shared/types'
import { useRoomDataRefresh } from './useRoomDataRefresh'

export function useTaskTypes() {
  const [types, setTypes] = useState<TaskType[]>([])

  const refresh = useCallback(() => {
    void window.api.getTaskTypes().then(setTypes).catch(() => setTypes([]))
  }, [])

  useEffect(() => {
    refresh()
    return window.api.subscribeTaskTypes(setTypes)
  }, [refresh])

  useRoomDataRefresh(refresh, true)

  return { types, setTypes, refresh }
}
