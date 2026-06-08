import { useCallback, useEffect, useState } from 'react'
import type { Room, Task } from '../../shared/types'
import { STATUS_LABELS } from '../../shared/taskStatus'
import { formatDueDate } from '../utils/dates'
import ConfirmDialog from '../components/ConfirmDialog'
import TaskEditor from '../components/TaskEditor'
import TooltipWrap from '../components/TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'
import { useTaskPriorities } from '../hooks/useTaskPriorities'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  onTasksChanged: () => void
}

function formatArchived(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('ru-RU')
}

export default function ArchiveScreen({ room, onTasksChanged }: Props) {
  const { types: taskTypes } = useTaskTypes()
  const { priorities: taskPriorities } = useTaskPriorities()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setTasks(await window.api.getArchivedTasks())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function restore(taskId: string) {
    try {
      await window.api.restoreArchivedTask(taskId)
      await load()
      onTasksChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось восстановить')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await window.api.deleteTask(deleteTarget.id)
      if (editingTask?.id === deleteTarget.id) {
        setEditingTask(null)
      }
      setDeleteTarget(null)
      await load()
      onTasksChanged()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="archive-page">
      <div className="archive-page-header">
        <h2>Архив задач</h2>
        <p className="lead">
          Выполненные задачи, убранные с доски. Можно вернуть на доску или удалить безвозвратно
          (вместе с файлами и историей).
        </p>
        <button type="button" className="btn" disabled={loading} onClick={() => void load()}>
          Обновить
        </button>
      </div>

      {loading && <p className="sub">Загрузка…</p>}
      {!loading && tasks.length === 0 && (
        <div className="info-box">Архив пуст. В колонке «Готово» нажмите «В архив».</div>
      )}

      {!loading && tasks.length > 0 && (
        <ul className="archive-list">
          {tasks.map((task) => {
            const assignee = room.state.employees[task.assignee_pc]
            return (
              <li key={task.id} className="archive-row">
                <div>
                  <strong>{task.title}</strong>
                  <span className="archive-row-meta">
                    {STATUS_LABELS[task.status]}
                    {task.due_date ? ` · срок ${formatDueDate(task.due_date)}` : ''}
                    {task.archived_at ? ` · в архиве ${formatArchived(task.archived_at)}` : ''}
                    {' · '}
                    {assignee?.name ?? '—'}
                  </span>
                </div>
                <div className="archive-row-actions">
                  <TooltipWrap text={UI_HINTS.archive.open}>
                    <button type="button" className="btn" onClick={() => setEditingTask(task)}>
                      Открыть
                    </button>
                  </TooltipWrap>
                  <TooltipWrap text={UI_HINTS.archive.restore}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void restore(task.id)}
                    >
                      Вернуть на доску
                    </button>
                  </TooltipWrap>
                  <TooltipWrap text={UI_HINTS.archive.delete}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setDeleteTarget(task)}
                    >
                      Удалить
                    </button>
                  </TooltipWrap>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Удалить задачу из архива?"
          message={`«${deleteTarget.title}» будет удалена безвозвратно вместе с прикреплёнными файлами и историей изменений.`}
          confirmLabel="Удалить"
          danger
          loading={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      {editingTask && (
        <TaskEditor
          roomState={room.state}
          currentPcId={room.pcId}
          taskTypes={taskTypes}
          taskPriorities={taskPriorities}
          task={editingTask}
          defaultStatus={editingTask.status}
          readOnlyArchived
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
