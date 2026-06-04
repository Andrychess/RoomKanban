import type { ColumnSortId } from '../../shared/columnSort'
import { COLUMN_SORT_OPTIONS } from '../../shared/columnSort'
import { HintLabel } from './HintIcon'

interface Props {
  value: ColumnSortId
  onChange: (sortId: ColumnSortId) => void
}

export default function ColumnSortSelect({ value, onChange }: Props) {
  return (
    <label className="column-sort">
      <HintLabel className="column-sort-label" topic="kanban.columnSort">
        Сортировка
      </HintLabel>
      <select
        className="column-sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as ColumnSortId)}
        aria-label="Сортировка в колонке"
        onClick={(e) => e.stopPropagation()}
      >
        {COLUMN_SORT_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
