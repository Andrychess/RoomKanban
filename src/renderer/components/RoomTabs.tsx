import { useEffect, useRef, useState } from 'react'
import type { Screen } from '../navigation/useNavHistory'
import RoomNotesPanel from './RoomNotesPanel'
import TooltipWrap from './TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'

type RoomTabId =
  | 'kanban'
  | 'kanbanByEmployee'
  | 'calendar'
  | 'team'
  | 'exchange'
  | 'archive'
  | 'dashboard'
  | 'overdue'

interface Props {
  active: RoomTabId
  isChief: boolean
  roomPath: string
  overdueCount?: number
  onChange: (screen: Screen) => void
  onOpenTaskTypes?: () => void
  onSeedTestTasks?: () => void
}

const PRIMARY_TABS: { id: RoomTabId; label: string; screen: Screen }[] = [
  { id: 'kanban', label: 'Задачи', screen: 'kanban' },
  { id: 'kanbanByEmployee', label: 'По сотрудникам', screen: 'kanbanByEmployee' },
  { id: 'calendar', label: 'Календарь', screen: 'calendar' }
]

const MORE_TABS: {
  id: RoomTabId
  label: string
  screen: Screen
  chiefOnly?: boolean
}[] = [
  { id: 'team', label: 'Сотрудники', screen: 'team' },
  { id: 'exchange', label: 'Обмен', screen: 'exchange' },
  { id: 'archive', label: 'Архив', screen: 'archive' },
  { id: 'dashboard', label: 'Сводка', screen: 'dashboard', chiefOnly: true },
  { id: 'overdue', label: 'Просрочено', screen: 'overdue', chiefOnly: true }
]

const MORE_TAB_IDS = new Set<RoomTabId>(MORE_TABS.map((tab) => tab.id))

function moreTabLabel(tab: (typeof MORE_TABS)[number], overdueCount: number): string {
  if (tab.id === 'overdue' && overdueCount > 0) {
    return `Просрочено (${overdueCount})`
  }
  return tab.label
}

export default function RoomTabs({
  active,
  isChief,
  roomPath,
  overdueCount = 0,
  onChange,
  onOpenTaskTypes,
  onSeedTestTasks
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreActive = MORE_TAB_IDS.has(active)

  const moreTabs = MORE_TABS.filter((tab) => !tab.chiefOnly || isChief)

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  function selectScreen(screen: Screen) {
    setMenuOpen(false)
    setNotesOpen(false)
    onChange(screen)
  }

  function openTaskTypes() {
    setMenuOpen(false)
    onOpenTaskTypes?.()
  }

  function seedTestTasks() {
    setMenuOpen(false)
    onSeedTestTasks?.()
  }

  return (
    <nav className="room-tabs" aria-label="Разделы">
      {PRIMARY_TABS.map((tab) => (
        <TooltipWrap key={tab.id} text={UI_HINTS.tabs[tab.id]}>
          <button
            type="button"
            className={`room-tab ${active === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.screen)}
          >
            {tab.label}
          </button>
        </TooltipWrap>
      ))}

      <RoomNotesPanel
        roomPath={roomPath}
        inline
        open={notesOpen}
        onOpenChange={(open) => {
          setNotesOpen(open)
          if (open) setMenuOpen(false)
        }}
      />

      <div className="room-tabs-more" ref={menuRef}>
        <TooltipWrap text="Остальные разделы: сотрудники, обмен, архив, виды задач и отчёты">
          <button
            type="button"
            className={`room-tab-more-btn ${moreActive ? 'active' : ''} ${menuOpen ? 'is-open' : ''}`}
            aria-label="Другие разделы"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open)
              if (!menuOpen) setNotesOpen(false)
            }}
          >
            <span className="room-tab-more-icon" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </button>
        </TooltipWrap>

        {menuOpen && (
          <div className="room-tabs-menu" role="menu">
            {moreTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="menuitem"
                className={`room-tabs-menu-item ${active === tab.id ? 'active' : ''} ${tab.id === 'overdue' && overdueCount > 0 ? 'has-alert' : ''}`}
                title={UI_HINTS.tabs[tab.id]}
                onClick={() => selectScreen(tab.screen)}
              >
                {moreTabLabel(tab, overdueCount)}
              </button>
            ))}
            {isChief && (onOpenTaskTypes || onSeedTestTasks) && (
              <>
                <div className="room-tabs-menu-sep" role="separator" />
                {onOpenTaskTypes && (
                  <button
                    type="button"
                    role="menuitem"
                    className="room-tabs-menu-item"
                    title={UI_HINTS.kanban.labels}
                    onClick={openTaskTypes}
                  >
                    Виды задач
                  </button>
                )}
                {onSeedTestTasks && (
                  <button
                    type="button"
                    role="menuitem"
                    className="room-tabs-menu-item"
                    title="Создать 15 тестовых задач во всех колонках канбана"
                    onClick={seedTestTasks}
                  >
                    Тестовые задачи (15)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
