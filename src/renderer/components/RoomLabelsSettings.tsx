import { useEffect, useState } from 'react'
import type { TaskType } from '../../shared/types'

interface Props {
  types: TaskType[]
  onClose: () => void
  onSaved: () => void
}

function newDraftType(): TaskType {
  return { id: `type_${Math.random().toString(36).slice(2, 9)}`, name: 'Новый вид', color: '#3b82f6' }
}

export default function RoomLabelsSettings({ types, onClose, onSaved }: Props) {
  const [draftTypes, setDraftTypes] = useState<TaskType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraftTypes(types.map((t) => ({ ...t })))
  }, [types])

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      await window.api.saveTaskTypes(draftTypes)
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
        <h2>Виды задач</h2>
        <p className="sub">Только для начальника комнаты. Виды синхронизируются с папкой.</p>

        {error && <div className="error">{error}</div>}

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
