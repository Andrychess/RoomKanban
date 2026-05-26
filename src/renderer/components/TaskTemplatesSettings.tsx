import { useState } from 'react'
import type { TaskTemplate } from '../../shared/types'
import { DEFAULT_PRIORITY_ID } from '../../shared/defaultTaskPriorities'
import { DEFAULT_TYPE_ID } from '../../shared/defaultTaskTypes'
import { useTaskTemplates } from '../hooks/useTaskTemplates'

interface Props {
  onClose: () => void
}

export default function TaskTemplatesSettings({ onClose }: Props) {
  const { templates, refresh } = useTaskTemplates()
  const [local, setLocal] = useState<TaskTemplate[] | null>(null)
  const [loading, setLoading] = useState(false)

  const list = local ?? templates

  function addTemplate() {
    const next: TaskTemplate = {
      id: `tpl_${Math.random().toString(36).slice(2, 9)}`,
      name: 'Новый шаблон',
      title: '',
      description: '',
      type_id: DEFAULT_TYPE_ID,
      priority_id: DEFAULT_PRIORITY_ID,
      due_days_offset: 7,
      status: 'todo',
      checklist: []
    }
    setLocal([...list, next])
  }

  async function save() {
    setLoading(true)
    try {
      await window.api.saveTaskTemplates(list)
      await refresh()
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Шаблоны задач</h2>
        <p className="sub">Быстрое создание типовых задач с готовым сроком и полями.</p>
        <ul className="templates-edit-list">
          {list.map((tpl, idx) => (
            <li key={tpl.id} className="templates-edit-row">
              <input
                value={tpl.name}
                placeholder="Название шаблона"
                onChange={(e) => {
                  const copy = [...list]
                  copy[idx] = { ...tpl, name: e.target.value }
                  setLocal(copy)
                }}
              />
              <input
                value={tpl.title}
                placeholder="Название задачи"
                onChange={(e) => {
                  const copy = [...list]
                  copy[idx] = { ...tpl, title: e.target.value }
                  setLocal(copy)
                }}
              />
              <input
                type="number"
                min={0}
                value={tpl.due_days_offset}
                title="Срок через N дней"
                onChange={(e) => {
                  const copy = [...list]
                  copy[idx] = { ...tpl, due_days_offset: Number(e.target.value) || 0 }
                  setLocal(copy)
                }}
              />
              <button
                type="button"
                className="btn-link danger"
                onClick={() => setLocal(list.filter((t) => t.id !== tpl.id))}
              >
                Удалить
              </button>
            </li>
          ))}
        </ul>
        <div className="actions-row">
          <button type="button" className="btn" onClick={addTemplate}>
            + Шаблон
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void save()}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
