import { useCallback, useMemo, useState } from 'react'

export type Screen =
  | 'welcome'
  | 'onboarding'
  | 'create'
  | 'join'
  | 'kanban'
  | 'myTasks'
  | 'myCalendar'
  | 'kanbanByEmployee'
  | 'calendar'
  | 'team'
  | 'overdue'
  | 'dashboard'
  | 'archive'
  | 'exchange'
  | 'departmentMail'

export const SCREEN_LABELS: Record<Screen, string> = {
  welcome: 'Главная',
  onboarding: 'Первый запуск',
  create: 'Новая комната',
  join: 'Вход в комнату',
  kanban: 'Канбан-доска',
  myTasks: 'Мои задачи',
  myCalendar: 'Мой календарь',
  kanbanByEmployee: 'По сотрудникам',
  calendar: 'Календарь комнаты',
  team: 'Состав комнаты',
  overdue: 'Просрочено',
  dashboard: 'Сводка',
  archive: 'Архив',
  exchange: 'Обмен',
  departmentMail: 'Почта отдела'
}

interface NavEntry {
  screen: Screen
  label: string
}

export function useNavHistory(initial: Screen = 'welcome') {
  const [history, setHistory] = useState<NavEntry[]>([
    { screen: initial, label: SCREEN_LABELS[initial] }
  ])
  const [index, setIndex] = useState(0)

  const screen = history[index]?.screen ?? initial
  const canBack = index > 0
  const canForward = index < history.length - 1
  const currentLabel = history[index]?.label ?? SCREEN_LABELS[initial]

  const navigate = useCallback(
    (next: Screen, options?: { replace?: boolean; reset?: boolean }) => {
      const entry: NavEntry = { screen: next, label: SCREEN_LABELS[next] }

      if (options?.reset) {
        setHistory([entry])
        setIndex(0)
        return
      }

      setHistory((prev) => {
        const base = prev.slice(0, index + 1)
        if (options?.replace) {
          const copy = [...base]
          copy[index] = entry
          return copy
        }
        return [...base, entry]
      })

      if (!options?.replace) {
        setIndex((i) => i + 1)
      }
    },
    [index]
  )

  const back = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i))
  }, [])

  const forward = useCallback(() => {
    setIndex((i) => (i < history.length - 1 ? i + 1 : i))
  }, [history.length])

  const breadcrumbs = useMemo(
    () => history.slice(0, index + 1).map((e) => e.label),
    [history, index]
  )

  return {
    screen,
    navigate,
    back,
    forward,
    canBack,
    canForward,
    currentLabel,
    breadcrumbs
  }
}
