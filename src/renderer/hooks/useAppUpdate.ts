import { useCallback, useEffect, useState } from 'react'
import type { AppUpdateStatus } from '../../shared/appUpdate'

export function useAppUpdate() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    void window.api.getAppUpdateStatus().then(setStatus)

    const unsubStatus = window.api.onAppUpdateStatus((next) => {
      setStatus(next)
      if (next.phase === 'downloading' || next.phase === 'downloaded' || next.phase === 'error') {
        setPanelOpen(true)
      }
    })

    const unsubOpen = window.api.onOpenAppUpdate(() => {
      setPanelOpen(true)
    })

    return () => {
      unsubStatus()
      unsubOpen()
    }
  }, [])

  const startUpdate = useCallback(() => {
    void window.api.startAppUpdate()
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
  }, [])

  const openPanel = useCallback(() => {
    setPanelOpen(true)
  }, [])

  return {
    status,
    panelOpen,
    startUpdate,
    closePanel,
    openPanel
  }
}
