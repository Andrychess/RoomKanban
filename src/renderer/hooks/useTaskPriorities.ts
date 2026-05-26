import { useEffect, useState } from 'react'
import type { TaskPriority } from '../../shared/types'

export function useTaskPriorities() {
  const [priorities, setPriorities] = useState<TaskPriority[]>([])

  useEffect(() => {
    void window.api.getTaskPriorities().then(setPriorities)
    return window.api.subscribeTaskPriorities(setPriorities)
  }, [])

  return {
    priorities,
    refresh: () => void window.api.getTaskPriorities().then(setPriorities)
  }
}
