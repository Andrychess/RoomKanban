import { useEffect, useState } from 'react'
import type { TaskTemplate } from '../../shared/types'

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])

  useEffect(() => {
    void window.api.getTaskTemplates().then(setTemplates)
    return window.api.subscribeTaskTemplates(setTemplates)
  }, [])

  return { templates, refresh: () => void window.api.getTaskTemplates().then(setTemplates) }
}
