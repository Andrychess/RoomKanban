import type { ReactNode } from 'react'
import type { Employee, RoomState } from '../../shared/types'
import { formatDueDate, formatDueDateShort } from '../utils/dates'

export function AssigneeAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="task-meta-avatar" aria-hidden="true">
      {initial}
    </span>
  )
}

interface ReadonlyProps {
  assignee?: Employee
  assigneeName: string
  dueDate: string | null
  overdue: boolean
  variant?: 'card-header' | 'card-compact' | 'detail'
  fileBadge?: ReactNode
  hideAssignee?: boolean
}

export function TaskMetaRowReadonly({
  assignee,
  assigneeName,
  dueDate,
  overdue,
  variant,
  fileBadge,
  hideAssignee = false
}: ReadonlyProps) {
  const dueLabel = dueDate ? formatDueDateShort(dueDate) : 'Без срока'
  const dueTitle = dueDate
    ? overdue
      ? `Просрочено: ${formatDueDate(dueDate)}`
      : `Срок: ${formatDueDate(dueDate)}`
    : 'Срок не указан'

  return (
    <div
      className={`task-meta-row ${variant ? `task-meta-row--${variant}` : ''}`}
      aria-label={hideAssignee ? 'Срок выполнения' : 'Ответственный и срок'}
    >
      {!hideAssignee && (
        <>
          <span className="task-meta-assignee">
            <AssigneeAvatar name={assignee?.name ?? ''} />
            <span className="task-meta-assignee-name" title={assigneeName}>
              {assigneeName}
            </span>
          </span>
          <span className="task-meta-sep" aria-hidden="true">
            ·
          </span>
        </>
      )}
      <time
        className={`task-meta-due ${overdue ? 'is-overdue' : ''} ${!dueDate ? 'is-empty' : ''}`}
        dateTime={dueDate ?? undefined}
        title={dueTitle}
      >
        {dueLabel}
      </time>
      {fileBadge}
    </div>
  )
}

interface EditorProps {
  employees: RoomState['employees']
  pcIds: string[]
  assigneePc: string
  dueDatePart: string
  dueTimePart: string
  overdue: boolean
  disabled?: boolean
  onAssigneeChange: (pcId: string) => void
  onDueDateChange: (value: string) => void
  onDueTimeChange: (value: string) => void
  onClearDue: () => void
}

export function TaskMetaRowEditor({
  employees,
  pcIds,
  assigneePc,
  dueDatePart,
  dueTimePart,
  overdue,
  disabled,
  onAssigneeChange,
  onDueDateChange,
  onDueTimeChange,
  onClearDue
}: EditorProps) {
  const assignee = employees[assigneePc]
  const assigneeName = assignee?.name ?? ''

  return (
    <div className="task-meta-row task-meta-row--editor" aria-label="Ответственный и срок">
      <span className="task-meta-assignee">
        <AssigneeAvatar name={assigneeName} />
        <select
          id="taskAssignee"
          className="task-meta-assignee-select"
          value={assigneePc}
          disabled={disabled}
          onChange={(e) => onAssigneeChange(e.target.value)}
          aria-label="Ответственный"
        >
          {pcIds.map((pcId) => (
            <option key={pcId} value={pcId}>
              {employees[pcId].name}
            </option>
          ))}
        </select>
      </span>
      <span className="task-meta-sep" aria-hidden="true">
        ·
      </span>
      <div className={`task-meta-due-fields ${overdue ? 'is-overdue' : ''}`}>
        <input
          id="taskDue"
          type="date"
          className="task-meta-date"
          value={dueDatePart}
          disabled={disabled}
          onChange={(e) => onDueDateChange(e.target.value)}
          aria-label="Дата срока"
        />
        <input
          id="taskDueTime"
          type="time"
          className="task-meta-time"
          value={dueTimePart}
          disabled={disabled}
          onChange={(e) => onDueTimeChange(e.target.value)}
          aria-label="Время срока"
        />
        {(dueDatePart || dueTimePart) && (
          <button
            type="button"
            className="btn-link task-meta-clear-due"
            disabled={disabled}
            onClick={onClearDue}
          >
            Очистить
          </button>
        )}
      </div>
    </div>
  )
}
