import { useCallback, useEffect, useState } from 'react'
import type { TaskFile } from '../../shared/types'
import { useRoomDataRefresh } from './useRoomDataRefresh'

export function useExchange(roomPath: string) {
  const [filesByEmployee, setFilesByEmployee] = useState<Record<string, TaskFile[]>>({})

  const refresh = useCallback(() => {
    if (!roomPath) {
      setFilesByEmployee({})
      return
    }
    void window.api.getExchangeFiles().then(setFilesByEmployee).catch(() => {
      setFilesByEmployee({})
    })
  }, [roomPath])

  useEffect(() => {
    if (!roomPath) {
      setFilesByEmployee({})
      return
    }
    refresh()
    return window.api.subscribeExchange(setFilesByEmployee)
  }, [roomPath, refresh])

  useRoomDataRefresh(refresh, Boolean(roomPath))

  return { filesByEmployee, refresh }
}
