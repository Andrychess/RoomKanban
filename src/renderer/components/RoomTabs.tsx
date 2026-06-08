import { useEffect, useRef, useState } from 'react'
import type { Screen } from '../navigation/useNavHistory'
import RoomNotesPanel from './RoomNotesPanel'
import TooltipWrap from './TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'

type RoomTabId =
  | 'myTasks'
  | 'myCalendar'
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
  { id: 'myTasks', label: 'Мои задачи', screen: 'myTasks' },
  { id: 'myCalendar', label: 'Мой календарь', screen: 'myCalendar' }
]

const MANAGEMENT_TABS: {
  id: RoomTabId
  label: string
  screen: Screen
  chiefOnly?: boolean
}[] = [
  { id: 'kanban', label: 'Все задачи', screen: 'kanban' },
  { id: 'kanbanByEmployee', label: 'По сотрудникам', screen: 'kanbanByEmployee' },
  { id: 'calendar', label: 'Календарь комнаты', screen: 'calendar' },
  { id: 'team', label: 'Сотрудники', screen: 'team' },
  { id: 'exchange', label: 'Обмен', screen: 'exchange' },
  { id: 'archive', label: 'Архив', screen: 'archive' },
  { id: 'dashboard', label: 'Сводка', screen: 'dashboard', chiefOnly: true },
  { id: 'overdue', label: 'Просрочено', screen: 'overdue', chiefOnly: true }
]

const MANAGEMENT_TAB_IDS = new Set<RoomTabId>(MANAGEMENT_TABS.map((tab) => tab.id))

function managementTabLabel(tab: (typeof MANAGEMENT_TABS)[number], overdueCount: number): string {
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
  const managementActive = MANAGEMENT_TAB_IDS.has(active)

  const managementTabs = MANAGEMENT_TABS.filter((tab) => !tab.chiefOnly || isChief)

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

  function openNotes() {
    setMenuOpen(false)
    setNotesOpen(true)
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

      <div className="room-tabs-management" ref={menuRef}>
        <TooltipWrap text="Все задачи комнаты, сотрудники, архив, заметки и настройки">
          <button
            type="button"
            className={`room-tab room-tab-management ${managementActive ? 'active' : ''} ${menuOpen || notesOpen ? 'is-open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open)
              if (!menuOpen) setNotesOpen(false)
            }}
          >
            Управление комнатой
          </button>
        </TooltipWrap>

        <RoomNotesPanel
          roomPath={roomPath}
          inline
          hideTab
          open={notesOpen}
          onOpenChange={setNotesOpen}
        />

        {menuOpen && (
          <div className="room-tabs-menu room-tabs-menu--management" role="menu">
            {managementTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="menuitem"
                className={`room-tabs-menu-item ${active === tab.id ? 'active' : ''} ${tab.id === 'overdue' && overdueCount > 0 ? 'has-alert' : ''}`}
                title={UI_HINTS.tabs[tab.id]}
                onClick={() => selectScreen(tab.screen)}
              >
                {managementTabLabel(tab, overdueCount)}
              </button>
            ))}
            <div className="room-tabs-menu-sep" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="room-tabs-menu-item"
              title="Общие заметки отдела"
              onClick={openNotes}
            >
              Заметки
            </button>
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
