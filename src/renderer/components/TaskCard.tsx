import type { ChangeEvent } from 'react'
import type { Employee, Task, TaskFileKind, TaskPriority, TaskType } from '../../shared/types'
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '../../shared/taskStatus'
import { TASK_FILE_GROUP_LABELS, taskHasFiles } from '../../shared/taskFiles'
import { formatDueDate, isOverdue } from '../utils/dates'
import { findTaskPriority, findTaskType } from '../utils/taskTypes'

interface Props {
  task: Task
  taskTypes: TaskType[]
  taskPriorities: TaskPriority[]
  assignee?: Employee
  columnAccent?: string
  onEdit: (task: Task) => void
  onOpenFile: (taskId: string, kind: TaskFileKind, fileId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
}

export default function TaskCard({
  task,
  taskTypes,
  taskPriorities,
  assignee,
  columnAccent,
  onEdit,
  onOpenFile,
  onStatusChange
}: Props) {
  const overdue = isOverdue(task.due_date, task.status)
  const taskType = findTaskType(taskTypes, task.type_id)
  const priority = findTaskPriority(taskPriorities, task.priority_id)
  const priorityColor = priority?.color ?? columnAccent ?? '#64748b'

  function onStatusSelect(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TaskStatus
    if (next !== task.status) onStatusChange(task.id, next)
  }

  return (
    <article
      className={`task-card ${overdue ? 'is-overdue' : ''}`}
      style={{ borderLeftColor: priorityColor }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="task-card-body" onClick={() => onEdit(task)}>
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

        {taskType && <span className="task-card-type">{taskType.name}</span>}

        {task.description && <p className="task-card-comment">{task.description}</p>}

        {task.checklist.length > 0 && (
          <p className="task-card-checklist">
            Чек-лист: {task.checklist.filter((i) => i.done).length}/{task.checklist.length}
          </p>
        )}

        {taskHasFiles(task) && (
          <ul className="task-card-file-links" onClick={(e) => e.stopPropagation()}>
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

      <div className="task-card-footer" onClick={(e) => e.stopPropagation()}>
        <label className="task-status-select-wrap">
          <span className="task-status-select-label">Этап</span>
          <select
            className="task-status-select"
            value={task.status}
            onChange={onStatusSelect}
            aria-label="На каком этапе задача"
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="task-card-open-btn" onClick={() => onEdit(task)}>
          Подробнее
        </button>
      </div>
    </article>
  )
}
