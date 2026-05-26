import { useEffect, useState } from 'react'
import type { TaskFile } from '../../shared/types'

export function useExchange(roomPath: string) {
  const [filesByEmployee, setFilesByEmployee] = useState<Record<string, TaskFile[]>>({})

  useEffect(() => {
    void window.api.getExchangeFiles().then(setFilesByEmployee)
    return window.api.subscribeExchange(setFilesByEmployee)
  }, [roomPath])

  return {
    filesByEmployee,
    refresh: () => void window.api.getExchangeFiles().then(setFilesByEmployee)
  }
}
