import { useEffect, useState } from 'react'
import type { TaskType } from '../../shared/types'

export function useTaskTypes() {
  const [types, setTypes] = useState<TaskType[]>([])

  useEffect(() => {
    void window.api.getTaskTypes().then(setTypes)
    return window.api.subscribeTaskTypes(setTypes)
  }, [])

  return { types, setTypes, refresh: () => void window.api.getTaskTypes().then(setTypes) }
}
