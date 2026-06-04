import type { ChecklistItem, RoomState, Task, TaskPriority, TaskType } from '../../shared/types'
import { STATUS_LABELS_FULL } from '../../shared/taskStatus'
import { isTaskOverdue } from '../../shared/overdue'
import { formatDueDate } from '../utils/dates'
import { findTaskPriority, findTaskType } from '../utils/taskTypes'

interface Props {
  task: Task
  roomState: RoomState
  taskTypes: TaskType[]
  taskPriorities: TaskPriority[]
}

function ChecklistReadonly({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) return null
  const done = items.filter((i) => i.done).length
  return (
    <section className="task-detail-block">
      <h3 className="task-detail-block-title">
        Чек-лист <span className="task-detail-muted">({done}/{items.length})</span>
      </h3>
      <ul className="task-detail-checklist">
        {items.map((item) => (
          <li key={item.id} className={item.done ? 'is-done' : ''}>
            <span className="task-detail-check" aria-hidden="true">
              {item.done ? '✓' : '○'}
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function TaskDetailView({ task, roomState, taskTypes, taskPriorities }: Props) {
  const taskType = findTaskType(taskTypes, task.type_id)
  const priority = findTaskPriority(taskPriorities, task.priority_id)
  const assignee = roomState.employees[task.assignee_pc]
  const overdue = isTaskOverdue(task)
  const typeColor = taskType?.color ?? '#64748b'

  return (
    <article className="task-detail-view">
      <div className="task-detail-type-bar" style={{ backgroundColor: typeColor }} />
      <header className="task-detail-header">
        <div className="task-detail-header-main">
          {taskType && (
            <span className="task-detail-type-pill" style={{ borderColor: typeColor, color: typeColor }}>
              {taskType.name}
            </span>
          )}
          <span className={`task-detail-status status-${task.status}`}>
            {STATUS_LABELS_FULL[task.status]}
          </span>
        </div>
        <h1 className="task-detail-title">{task.title}</h1>
      </header>

      <dl className="task-detail-meta">
        <div className="task-detail-meta-item">
          <dt>Ответственный</dt>
          <dd>{assignee ? `${assignee.name} · ${assignee.role}` : task.assignee_pc}</dd>
        </div>
        <div className="task-detail-meta-item">
          <dt>Приоритет</dt>
          <dd>
            {priority ? (
              <span className="task-detail-priority" style={{ color: priority.color ?? undefined }}>
                {priority.name}
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="task-detail-meta-item">
          <dt>Срок</dt>
          <dd>
            {task.due_date ? (
              <time
                className={overdue ? 'task-detail-due is-overdue' : 'task-detail-due'}
                dateTime={task.due_date}
              >
                {formatDueDate(task.due_date)}
              </time>
            ) : (
              <span className="task-detail-muted">Не задан</span>
            )}
          </dd>
        </div>
        <div className="task-detail-meta-item">
          <dt>Вид</dt>
          <dd>{taskType?.name ?? '—'}</dd>
        </div>
      </dl>

      {task.description.trim() ? (
        <section className="task-detail-block">
          <h3 className="task-detail-block-title">Описание</h3>
          <div className="task-detail-description">{task.description}</div>
        </section>
      ) : null}

      <ChecklistReadonly items={task.checklist} />
    </article>
  )
}
