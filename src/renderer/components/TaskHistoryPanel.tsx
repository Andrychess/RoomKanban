import { useEffect, useState } from 'react'
import type { TaskHistoryEntry } from '../../shared/types'
import { HISTORY_ACTION_LABELS } from '../../shared/taskHistory'

interface Props {
  taskId: string
  showTitle?: boolean
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TaskHistoryPanel({ taskId, showTitle = true }: Props) {
  const [entries, setEntries] = useState<TaskHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void window.api.getTaskHistory(taskId).then((list) => {
      setEntries(list)
      setLoading(false)
    })
  }, [taskId])

  if (loading) return <p className="sub">Загрузка истории…</p>
  if (entries.length === 0) return <p className="sub">История изменений пока пуста</p>

  return (
    <div className="task-history">
      {showTitle && <h3 className="task-section-title">История изменений</h3>}
      <ul className="task-history-list">
        {entries.map((e) => (
          <li key={e.id}>
            <time>{formatTime(e.at)}</time>
            <strong>{e.employee_name}</strong>
            <span>
              {HISTORY_ACTION_LABELS[e.action]}
              {e.detail ? ` — ${e.detail}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
