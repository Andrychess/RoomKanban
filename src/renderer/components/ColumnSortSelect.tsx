import type { ColumnSortId } from '../../shared/columnSort'
import { COLUMN_SORT_OPTIONS } from '../../shared/columnSort'

interface Props {
  value: ColumnSortId
  onChange: (sortId: ColumnSortId) => void
}

export default function ColumnSortSelect({ value, onChange }: Props) {
  return (
    <label className="column-sort">
      <span className="column-sort-label">Сортировка</span>
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
