import { useEffect, useState } from 'react'
import type { TaskPriority, TaskType } from '../../shared/types'

interface Props {
  types: TaskType[]
  priorities: TaskPriority[]
  onClose: () => void
  onSaved: () => void
}

type Tab = 'types' | 'priorities'

function newDraftType(): TaskType {
  return { id: `type_${Math.random().toString(36).slice(2, 9)}`, name: 'Новый вид', color: '#3b82f6' }
}

function newDraftPriority(): TaskPriority {
  return {
    id: `priority_${Math.random().toString(36).slice(2, 9)}`,
    name: 'Новый приоритет',
    color: '#f97316'
  }
}

export default function RoomLabelsSettings({ types, priorities, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('types')
  const [draftTypes, setDraftTypes] = useState<TaskType[]>([])
  const [draftPriorities, setDraftPriorities] = useState<TaskPriority[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraftTypes(types.map((t) => ({ ...t })))
    setDraftPriorities(priorities.map((p) => ({ ...p })))
  }, [types, priorities])

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      await window.api.saveTaskTypes(draftTypes)
      await window.api.saveTaskPriorities(draftPriorities)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Метки задач</h2>
        <p className="sub">Только для начальника комнаты. Виды и приоритеты синхронизируются с папкой.</p>

        <div className="settings-tabs">
          <button
            type="button"
            className={`settings-tab ${tab === 'types' ? 'active' : ''}`}
            onClick={() => setTab('types')}
          >
            Виды задач
          </button>
          <button
            type="button"
            className={`settings-tab ${tab === 'priorities' ? 'active' : ''}`}
            onClick={() => setTab('priorities')}
          >
            Приоритеты
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {tab === 'types' && (
          <>
            <ul className="type-settings-list">
              {draftTypes.map((t, index) => (
                <li key={t.id} className="type-settings-row">
                  <input
                    type="color"
                    value={t.color}
                    onChange={(e) =>
                      setDraftTypes((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, color: e.target.value } : row))
                      )
                    }
                    className="type-color-input"
                  />
                  <span className="type-preview-badge" style={{ background: t.color }}>
                    {t.name || '—'}
                  </span>
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) =>
                      setDraftTypes((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row))
                      )
                    }
                    className="type-name-input"
                  />
                  <button
                    type="button"
                    className="btn-link danger"
                    disabled={draftTypes.length <= 1}
                    onClick={() => {
                      if (draftTypes.length <= 1) {
                        setError('Нельзя удалить последний вид')
                        return
                      }
                      setDraftTypes((prev) => prev.filter((_, i) => i !== index))
                    }}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-block"
              style={{ marginTop: 12 }}
              onClick={() => setDraftTypes((prev) => [...prev, newDraftType()])}
            >
              + Добавить вид
            </button>
          </>
        )}

        {tab === 'priorities' && (
          <>
            <ul className="type-settings-list">
              {draftPriorities.map((p, index) => (
                <li key={p.id} className="type-settings-row">
                  <input
                    type="color"
                    value={p.color}
                    onChange={(e) =>
                      setDraftPriorities((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, color: e.target.value } : row))
                      )
                    }
                    className="type-color-input"
                  />
                  <span className="priority-preview-badge" style={{ borderColor: p.color, color: p.color }}>
                    {p.name || '—'}
                  </span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) =>
                      setDraftPriorities((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row))
                      )
                    }
                    className="type-name-input"
                  />
                  <button
                    type="button"
                    className="btn-link danger"
                    disabled={draftPriorities.length <= 1}
                    onClick={() => {
                      if (draftPriorities.length <= 1) {
                        setError('Нельзя удалить последний приоритет')
                        return
                      }
                      setDraftPriorities((prev) => prev.filter((_, i) => i !== index))
                    }}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-block"
              style={{ marginTop: 12 }}
              onClick={() => setDraftPriorities((prev) => [...prev, newDraftPriority()])}
            >
              + Добавить приоритет
            </button>
          </>
        )}

        <div className="actions-row">
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void handleSave()}>
            {loading ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
