import { useEffect, useState } from 'react'
import type { Task } from '../../shared/types'

export function useRoomTasks(roomPath: string) {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    void window.api.getTasks().then(setTasks)
    return window.api.subscribeTasks(setTasks)
  }, [roomPath])

  return { tasks, setTasks, refresh: () => void window.api.getTasks().then(setTasks) }
}
