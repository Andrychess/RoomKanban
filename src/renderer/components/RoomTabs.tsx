import type { Screen } from '../navigation/useNavHistory'
import TooltipWrap from './TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'

type RoomTabId = 'kanban' | 'calendar' | 'team' | 'exchange' | 'archive' | 'dashboard' | 'overdue'

interface Props {
  active: RoomTabId
  isChief: boolean
  overdueCount?: number
  onChange: (screen: Screen) => void
}

export default function RoomTabs({ active, isChief, overdueCount = 0, onChange }: Props) {
  const tabs: { id: RoomTabId; label: string; screen: Screen }[] = [
    { id: 'kanban', label: 'Задачи', screen: 'kanban' },
    { id: 'calendar', label: 'Сроки', screen: 'calendar' },
    { id: 'team', label: 'Сотрудники', screen: 'team' },
    { id: 'exchange', label: 'Обмен', screen: 'exchange' },
    { id: 'archive', label: 'Архив', screen: 'archive' }
  ]

  if (isChief) {
    tabs.push({ id: 'dashboard', label: 'Сводка', screen: 'dashboard' })
    tabs.push({
      id: 'overdue',
      label: overdueCount > 0 ? `Просрочено (${overdueCount})` : 'Просрочено',
      screen: 'overdue'
    })
  }

  return (
    <nav className="room-tabs" aria-label="Разделы">
      {tabs.map((tab) => (
        <TooltipWrap key={tab.id} text={UI_HINTS.tabs[tab.id]}>
          <button
            type="button"
            className={`room-tab ${active === tab.id ? 'active' : ''} ${tab.id === 'overdue' && overdueCount > 0 ? 'has-alert' : ''}`}
            onClick={() => onChange(tab.screen)}
          >
            {tab.label}
          </button>
        </TooltipWrap>
      ))}
    </nav>
  )
}
