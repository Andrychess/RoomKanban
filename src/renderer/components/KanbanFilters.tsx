import { useMemo } from 'react'
import type { Employee, TaskType } from '../../shared/types'
import { HintLabel } from './HintIcon'
import { UI_HINTS } from '../hints/uiHints'
import type { KanbanTaskFilters, OwnershipFilter } from '../hooks/useKanbanTaskFilters'
import TooltipWrap from './TooltipWrap'

interface Props {
  filters: KanbanTaskFilters
  employees: Record<string, Employee>
  taskTypes: TaskType[]
  hasActiveFilters: boolean
  hideOwnershipFilter?: boolean
  onChange: (next: KanbanTaskFilters) => void
  onReset: () => void
}

const OWNERSHIP_OPTIONS: { value: OwnershipFilter; label: string }[] = [
  { value: 'all', label: 'Все задачи' },
  { value: 'mine', label: 'Только мои' },
  { value: 'not_mine', label: 'Чужие' }
]

export default function KanbanFilters({
  filters,
  employees,
  taskTypes,
  hasActiveFilters,
  hideOwnershipFilter = false,
  onChange,
  onReset
}: Props) {
  const employeeOptions = useMemo(
    () =>
      Object.entries(employees)
        .map(([pcId, emp]) => ({ pcId, name: emp.name, role: emp.role }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [employees]
  )

  return (
    <div className="kanban-filters-wrap">
      <div className="kanban-filters" role="search" aria-label="Фильтр задач">
        <label className="kanban-filter kanban-filter-search">
          <HintLabel className="kanban-filter-label" topic="filters.search">
            Поиск
          </HintLabel>
          <input
            type="search"
            value={filters.query}
            placeholder="Название, описание, сотрудник…"
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
          />
        </label>

        <label className="kanban-filter">
          <HintLabel className="kanban-filter-label" topic="filters.type">
            Вид задачи
          </HintLabel>
          <select
            value={filters.typeId}
            onChange={(e) => onChange({ ...filters, typeId: e.target.value })}
          >
            <option value="all">Любой</option>
            {taskTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        {!hideOwnershipFilter && (
        <label className="kanban-filter">
          <HintLabel className="kanban-filter-label" topic="filters.ownership">
            Кому назначено
          </HintLabel>
          <select
            value={filters.ownership}
            onChange={(e) =>
              onChange({ ...filters, ownership: e.target.value as OwnershipFilter })
            }
          >
            <optgroup label="Общее">
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            {employeeOptions.length > 0 && (
              <optgroup label="Сотрудники">
                {employeeOptions.map((emp) => (
                  <option key={emp.pcId} value={emp.pcId}>
                    {emp.name}
                    {emp.role ? ` · ${emp.role}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        )}

        {hasActiveFilters && (
          <TooltipWrap text={UI_HINTS.filters.reset}>
            <button type="button" className="btn btn-ghost kanban-filter-reset" onClick={onReset}>
              Сбросить
            </button>
          </TooltipWrap>
        )}
      </div>
    </div>
  )
}
