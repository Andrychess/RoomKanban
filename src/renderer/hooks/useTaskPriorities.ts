import { useCallback, useEffect, useState } from 'react'
import type { TaskPriority } from '../../shared/types'
import { useRoomDataRefresh } from './useRoomDataRefresh'

export function useTaskPriorities() {
  const [priorities, setPriorities] = useState<TaskPriority[]>([])

  const refresh = useCallback(() => {
    void window.api.getTaskPriorities().then(setPriorities).catch(() => setPriorities([]))
  }, [])

  useEffect(() => {
    refresh()
    return window.api.subscribeTaskPriorities(setPriorities)
  }, [refresh])

  useRoomDataRefresh(refresh, true)

  return { priorities, refresh }
}
