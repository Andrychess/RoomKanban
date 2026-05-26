import { useState } from 'react'
import type { TaskPriority, TaskType } from '../../shared/types'
import type { KanbanTaskFilters, OwnershipFilter } from '../hooks/useKanbanTaskFilters'

interface Props {
  filters: KanbanTaskFilters
  taskTypes: TaskType[]
  taskPriorities: TaskPriority[]
  hasActiveFilters: boolean
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
  taskTypes,
  taskPriorities,
  hasActiveFilters,
  onChange,
  onReset
}: Props) {
  const [open, setOpen] = useState(hasActiveFilters)

  return (
    <div className={`kanban-filters-wrap ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`kanban-filters-toggle ${hasActiveFilters ? 'has-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {hasActiveFilters ? 'Фильтр включён' : 'Показать фильтр'}
        <span className="kanban-filters-chevron" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="kanban-filters" role="search" aria-label="Фильтр задач">
          <label className="kanban-filter kanban-filter-search">
            <span className="kanban-filter-label">Поиск</span>
            <input
              type="search"
              value={filters.query}
              placeholder="Название, описание, сотрудник…"
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
            />
          </label>

          <label className="kanban-filter">
            <span className="kanban-filter-label">Срочность</span>
            <select
              value={filters.priorityId}
              onChange={(e) => onChange({ ...filters, priorityId: e.target.value })}
            >
              <option value="all">Любая</option>
              {taskPriorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="kanban-filter">
            <span className="kanban-filter-label">Вид задачи</span>
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

          <label className="kanban-filter">
            <span className="kanban-filter-label">Кому назначено</span>
            <select
              value={filters.ownership}
              onChange={(e) =>
                onChange({ ...filters, ownership: e.target.value as OwnershipFilter })
              }
            >
              {OWNERSHIP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters && (
            <button type="button" className="btn btn-ghost" onClick={onReset}>
              Сбросить
            </button>
          )}
        </div>
      )}
    </div>
  )
}
