import { useCallback, useEffect, useState } from 'react'
import type { TaskTemplate } from '../../shared/types'
import { useRoomDataRefresh } from './useRoomDataRefresh'

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])

  const refresh = useCallback(() => {
    void window.api.getTaskTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    refresh()
    return window.api.subscribeTaskTemplates(setTemplates)
  }, [refresh])

  useRoomDataRefresh(refresh, true)

  return { templates, refresh }
}
