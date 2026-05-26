import { useState } from 'react'
import type { Task, TaskComment } from '../../shared/types'

interface Props {
  task: Task
  readOnly?: boolean
  onAdded: () => void
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TaskComments({ task, readOnly, onAdded }: Props) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || readOnly) return
    setLoading(true)
    setError('')
    try {
      await window.api.addTaskComment(task.id, text)
      setText('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
    } finally {
      setLoading(false)
    }
  }

  const sorted = [...task.comments].sort((a, b) => b.created_at - a.created_at)

  return (
    <div className="task-comments">
      <h3 className="task-section-title">Комментарии</h3>
      {sorted.length === 0 && <p className="sub">Пока нет комментариев</p>}
      <ul className="task-comments-list">
        {sorted.map((c: TaskComment) => (
          <li key={c.id} className="task-comment-item">
            <div className="task-comment-meta">
              <strong>{c.author_name}</strong>
              <time>{formatTime(c.created_at)}</time>
            </div>
            <p>{c.text}</p>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form className="task-comment-form" onSubmit={(e) => void submit(e)}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Написать комментарий…"
            rows={2}
          />
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading || !text.trim()}>
            {loading ? 'Отправка…' : 'Добавить'}
          </button>
        </form>
      )}
    </div>
  )
}
