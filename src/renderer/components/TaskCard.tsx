import type { ChangeEvent, CSSProperties } from 'react'
import type { Employee, Task, TaskFileKind, TaskPriority, TaskType } from '../../shared/types'
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '../../shared/taskStatus'
import { TASK_FILE_GROUP_LABELS, taskHasFiles } from '../../shared/taskFiles'
import { isTaskOverdue } from '../../shared/overdue'
import { UI_HINTS } from '../hints/uiHints'
import { formatDueDate } from '../utils/dates'
import TooltipWrap from './TooltipWrap'
import { findTaskPriority, findTaskType } from '../utils/taskTypes'

interface Props {
  task: Task
  taskTypes: TaskType[]
  taskPriorities: TaskPriority[]
  assignee?: Employee
  columnAccent?: string
  onViewDetails: (task: Task) => void
  onEdit: (task: Task) => void
  onOpenFile: (taskId: string, kind: TaskFileKind, fileId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L14.5 3.5a1.4 1.4 0 0 0-2 0L4 12v8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12.5 6.5l5 5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

export default function TaskCard({
  task,
  taskTypes,
  taskPriorities,
  assignee,
  columnAccent,
  onViewDetails,
  onEdit,
  onOpenFile,
  onStatusChange
}: Props) {
  const overdue = isTaskOverdue(task)
  const taskType = findTaskType(taskTypes, task.type_id)
  const priority = findTaskPriority(taskPriorities, task.priority_id)
  const priorityColor = priority?.color ?? columnAccent ?? '#64748b'
  const typeColor = taskType?.color ?? '#64748b'

  function onStatusSelect(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TaskStatus
    if (next !== task.status) onStatusChange(task.id, next)
  }

  return (
    <article
      className={`task-card ${overdue ? 'is-overdue' : ''} ${taskType ? 'task-card--has-type' : ''}`}
      style={
        {
          borderLeftColor: priorityColor,
          '--task-type-color': typeColor
        } as CSSProperties
      }
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      {taskType && (
        <div
          className="task-card-type-bar"
          style={{ backgroundColor: typeColor }}
          title={`Вид: ${taskType.name}`}
        >
          {taskType.name}
        </div>
      )}

      <div className="task-card-body">
        <div className="task-card-head">
          {priority && (
            <span
              className="task-priority-pill"
              style={{ borderColor: priority.color, color: priority.color }}
            >
              {priority.name}
            </span>
          )}
          {task.due_date && (
            <time className={`task-due ${overdue ? 'is-overdue' : ''}`} dateTime={task.due_date}>
              до {formatDueDate(task.due_date)}
            </time>
          )}
        </div>

        <h4 className="task-card-title">{task.title}</h4>

        {task.description && <p className="task-card-comment">{task.description}</p>}

        {task.checklist.length > 0 && (
          <p className="task-card-checklist">
            Чек-лист: {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
          </p>
        )}

        {taskHasFiles(task) && (
          <ul className="task-card-file-links">
            {(['source', 'completed'] as const).map((kind) =>
              (kind === 'source' ? task.source_files : task.completed_files).map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="task-file-link"
                    onClick={() => onOpenFile(task.id, kind, file.id)}
                  >
                    <span className="task-file-kind">{TASK_FILE_GROUP_LABELS[kind]}:</span> {file.file_name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        <p className="task-card-people">Ответственный: {assignee?.name ?? '—'}</p>
      </div>

      <div className="task-card-footer">
        <label className="task-status-select-wrap" title={UI_HINTS.taskCard.status}>
          <span className="task-status-select-label">Этап</span>
          <select
            className="task-status-select"
            value={task.status}
            onChange={onStatusSelect}
            aria-label="На каком этапе задача"
            onClick={(e) => e.stopPropagation()}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <TooltipWrap text={UI_HINTS.taskCard.details}>
          <button type="button" className="task-card-open-btn" onClick={() => onViewDetails(task)}>
            Подробнее
          </button>
        </TooltipWrap>
        <TooltipWrap text={UI_HINTS.taskCard.edit}>
          <button
            type="button"
            className="task-card-edit-btn"
            aria-label="Редактировать задачу"
            onClick={() => onEdit(task)}
          >
            <EditIcon />
          </button>
        </TooltipWrap>
      </div>
    </article>
  )
}
