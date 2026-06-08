import type { CSSProperties } from 'react'
import { COLUMN_THEMES, STATUS_LABELS_FULL, TASK_STATUSES, type TaskStatus } from '../../shared/taskStatus'
import TooltipWrap from './TooltipWrap'

interface Props {
  status: TaskStatus
  onChange: (status: TaskStatus) => void
  compact?: boolean
}

export default function TaskStatusCubes({ status, onChange, compact = false }: Props) {
  return (
    <div
      className={`task-status-cubes ${compact ? 'task-status-cubes--compact' : ''}`}
      role="group"
      aria-label="Этап задачи"
    >
      {TASK_STATUSES.map((stage) => {
        const active = stage === status
        const color = COLUMN_THEMES[stage].accent
        const label = STATUS_LABELS_FULL[stage]

        return (
          <TooltipWrap key={stage} text={label}>
            <button
              type="button"
              className={`task-status-cube task-card-no-drag ${active ? 'is-active' : ''}`}
              style={{ '--status-color': color } as CSSProperties}
              aria-label={label}
              aria-pressed={active}
              onClick={(e) => {
                e.stopPropagation()
                if (!active) onChange(stage)
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </TooltipWrap>
        )
      })}
    </div>
  )
}
