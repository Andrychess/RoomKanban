import { useCallback, useEffect, useState } from 'react'
import type { Task } from '../../shared/types'
import { useRoomDataRefresh } from './useRoomDataRefresh'

export function useRoomTasks(roomPath: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!roomPath) {
      setTasks([])
      return
    }
    setLoadError(null)
    void window.api
      .getTasks()
      .then(setTasks)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить задачи')
      })
  }, [roomPath])

  useEffect(() => {
    if (!roomPath) {
      setTasks([])
      setLoadError(null)
      return
    }
    refresh()
    return window.api.subscribeTasks((next) => {
      setLoadError(null)
      setTasks(next)
    })
  }, [roomPath, refresh])

  useRoomDataRefresh(refresh, Boolean(roomPath))

  return { tasks, setTasks, refresh, loadError }
}
