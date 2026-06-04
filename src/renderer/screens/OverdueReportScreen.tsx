import { useCallback, useEffect, useState } from 'react'
import type { Room, Task } from '../../shared/types'
import { daysOverdue } from '../../shared/dates'
import { STATUS_LABELS } from '../../shared/taskStatus'
import { formatDueDate } from '../utils/dates'
import TaskEditor from '../components/TaskEditor'
import { useTaskPriorities } from '../hooks/useTaskPriorities'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  onTasksChanged: () => void
}

export default function OverdueReportScreen({ room, onTasksChanged }: Props) {
  const { types: taskTypes } = useTaskTypes()
  const { priorities: taskPriorities } = useTaskPriorities()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.api.getOverdueTasks()
      setTasks(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openTask(task: Task) {
    setEditingTask(task)
  }

  return (
    <div className="overdue-page">
      <div className="overdue-page-header">
        <h2>Просроченные задачи</h2>
        <p className="lead">
          Задачи с истёкшим сроком, которые ещё не в колонке «Готово». Только для начальника.
        </p>
        <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
          {loading ? 'Обновление…' : 'Обновить список'}
        </button>
      </div>

      {loading && <p className="sub">Загрузка…</p>}

      {!loading && tasks.length === 0 && (
        <div className="info-box overdue-empty-ok">Просроченных задач нет — всё в срок.</div>
      )}

      {!loading && tasks.length > 0 && (
        <ul className="overdue-list">
          {tasks.map((task) => {
            const assignee = room.state.employees[task.assignee_pc]
            const days = task.due_date ? daysOverdue(task.due_date, task.status) : 0
            return (
              <li key={task.id} className="overdue-row">
                <div className="overdue-row-main">
                  <strong className="overdue-row-title">{task.title}</strong>
                  <span className="overdue-row-meta">
                    Срок: {task.due_date ? formatDueDate(task.due_date) : '—'}
                    <span className="overdue-days"> · просрочено {days} дн.</span>
                  </span>
                  <span className="overdue-row-meta">
                    {STATUS_LABELS[task.status]} · {assignee?.name ?? '—'}
                  </span>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => openTask(task)}>
                  Открыть
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editingTask && (
        <TaskEditor
          roomState={room.state}
          currentPcId={room.pcId}
          taskTypes={taskTypes}
          taskPriorities={taskPriorities}
          task={editingTask}
          defaultStatus={editingTask.status}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            void load()
            onTasksChanged()
          }}
        />
      )}
    </div>
  )
}
