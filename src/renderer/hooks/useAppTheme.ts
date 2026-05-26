import { useCallback, useEffect, useState } from 'react'
import type { AppTheme } from '../../shared/types'

const STORAGE_KEY = 'room-kanban-theme'

function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

function readCachedTheme(): AppTheme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return null
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => readCachedTheme() ?? 'dark')

  useEffect(() => {
    const cached = readCachedTheme()
    if (cached) applyTheme(cached)
    void window.api.getAppTheme().then((t) => {
      setTheme(t)
      applyTheme(t)
    })
  }, [])

  const toggleTheme = useCallback(async () => {
    const next: AppTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    await window.api.setAppTheme(next)
  }, [theme])

  const setAppTheme = useCallback(async (next: AppTheme) => {
    setTheme(next)
    applyTheme(next)
    await window.api.setAppTheme(next)
  }, [])

  return { theme, toggleTheme, setAppTheme }
}
