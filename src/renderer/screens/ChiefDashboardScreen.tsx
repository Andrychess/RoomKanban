import { useCallback, useEffect, useState } from 'react'
import type { ChiefDashboardData } from '../../shared/chiefDashboard'
import type { Room, Task } from '../../shared/types'
import { STATUS_LABELS } from '../../shared/taskStatus'
import ReminderSettingsPanel from '../components/ReminderSettingsPanel'
import TaskEditor from '../components/TaskEditor'
import { useTaskPriorities } from '../hooks/useTaskPriorities'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  onOpenOverdue: () => void
  onTasksChanged: () => void
}

export default function ChiefDashboardScreen({ room, onOpenOverdue, onTasksChanged }: Props) {
  const { types: taskTypes } = useTaskTypes()
  const { priorities: taskPriorities } = useTaskPriorities()
  const [data, setData] = useState<ChiefDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await window.api.getChiefDashboard())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2>Сводка для начальника</h2>
        <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
          Обновить
        </button>
      </div>

      {loading && <p className="sub">Загрузка…</p>}

      {data && !loading && (
        <>
          <div className="dashboard-cards">
            <button type="button" className="dashboard-card dashboard-card-alert" onClick={onOpenOverdue}>
              <span className="dashboard-card-value">{data.overdue_count}</span>
              <span className="dashboard-card-label">Просрочено</span>
            </button>
            <div className="dashboard-card">
              <span className="dashboard-card-value">{data.without_due_count}</span>
              <span className="dashboard-card-label">Без срока (не готово)</span>
            </div>
            <div className="dashboard-card">
              <span className="dashboard-card-value">{data.stuck_tasks.length}</span>
              <span className="dashboard-card-label">В работе &gt; 7 дней</span>
            </div>
          </div>

          <section className="dashboard-section">
            <h3>Нагрузка по сотрудникам</h3>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Активных</th>
                  <th>В работе</th>
                  <th>Просрочено</th>
                </tr>
              </thead>
              <tbody>
                {data.workload.map((row) => (
                  <tr key={row.employee_key}>
                    <td>{row.name}</td>
                    <td>{row.total}</td>
                    <td>{row.in_progress}</td>
                    <td className={row.overdue > 0 ? 'cell-danger' : ''}>{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {data.stuck_tasks.length > 0 && (
            <section className="dashboard-section">
              <h3>Долго в работе</h3>
              <ul className="dashboard-stuck-list">
                {data.stuck_tasks.map(({ task, days_in_progress }) => (
                  <li key={task.id}>
                    <button type="button" className="btn-link" onClick={() => setEditingTask(task)}>
                      {task.title}
                    </button>
                    <span className="sub">
                      {days_in_progress} дн. · {STATUS_LABELS[task.status]} ·{' '}
                      {room.state.employees[task.assignee_pc]?.name ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ReminderSettingsPanel />
        </>
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
