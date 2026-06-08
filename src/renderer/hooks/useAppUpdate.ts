import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppUpdateStatus } from '../../shared/appUpdate'

export function useAppUpdate() {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelDismissedRef = useRef(false)

  useEffect(() => {
    void window.api.getAppUpdateStatus().then(setStatus)

    const unsubStatus = window.api.onAppUpdateStatus((next) => {
      setStatus(next)
      if (next.phase === 'downloaded' || next.phase === 'error') {
        panelDismissedRef.current = false
        setPanelOpen(true)
        return
      }
      if (next.phase === 'downloading' && !panelDismissedRef.current) {
        setPanelOpen(true)
      }
    })

    const unsubOpen = window.api.onOpenAppUpdate(() => {
      panelDismissedRef.current = false
      setPanelOpen(true)
      void window.api.startAppUpdate()
    })

    return () => {
      unsubStatus()
      unsubOpen()
    }
  }, [])

  const startUpdate = useCallback(() => {
    panelDismissedRef.current = false
    void window.api.startAppUpdate()
  }, [])

  const closePanel = useCallback(() => {
    panelDismissedRef.current = true
    setPanelOpen(false)
  }, [])

  const openPanel = useCallback(() => {
    panelDismissedRef.current = false
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
