import { useState } from 'react'
import type { ChecklistItem } from '../../shared/types'

interface Props {
  items: ChecklistItem[]
  disabled?: boolean
  onChange: (items: ChecklistItem[]) => void
}

function newItemId(): string {
  return `chk_${Math.random().toString(36).slice(2, 9)}`
}

export default function TaskChecklist({ items, disabled, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function toggle(id: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  }

  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id))
  }

  function addItem() {
    const text = draft.trim()
    if (!text) return
    onChange([...items, { id: newItemId(), text, done: false }])
    setDraft('')
  }

  const doneCount = items.filter((i) => i.done).length

  return (
    <div className="task-checklist">
      <h3 className="task-section-title">
        Чек-лист{items.length > 0 ? ` (${doneCount}/${items.length})` : ''}
      </h3>
      <ul className="task-checklist-list">
        {items.map((item) => (
          <li key={item.id} className={item.done ? 'is-done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                disabled={disabled}
                onChange={() => toggle(item.id)}
              />
              <span>{item.text}</span>
            </label>
            {!disabled && (
              <button type="button" className="btn-link" onClick={() => remove(item.id)}>
                Удалить
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="task-checklist-add">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Новый пункт…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
          />
          <button type="button" className="btn" onClick={addItem} disabled={!draft.trim()}>
            Добавить
          </button>
        </div>
      )}
    </div>
  )
}
