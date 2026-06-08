import type { RoomState, Task, TaskType } from '../../shared/types'
import { STATUS_LABELS_FULL } from '../../shared/taskStatus'
import { isTaskOverdue } from '../../shared/overdue'
import { findTaskType } from '../utils/taskTypes'
import { TaskMetaRowReadonly } from './TaskMetaRow'

interface Props {
  task: Task
  roomState: RoomState
  taskTypes: TaskType[]
}

export default function TaskDetailView({ task, roomState, taskTypes }: Props) {
  const taskType = findTaskType(taskTypes, task.type_id)
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
        <TaskMetaRowReadonly
          assignee={assignee}
          assigneeName={assignee?.name ?? task.assignee_pc}
          dueDate={task.due_date}
          overdue={overdue}
          variant="detail"
        />
      </header>

      {task.description.trim() ? (
        <section className="task-detail-block">
          <h3 className="task-detail-block-title">Описание</h3>
          <div className="task-detail-description">{task.description}</div>
        </section>
      ) : null}
    </article>
  )
}
