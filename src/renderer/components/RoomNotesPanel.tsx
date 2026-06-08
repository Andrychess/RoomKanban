import { useState, type MouseEvent } from 'react'
import type { RoomNote } from '../../shared/types'
import { useRoomNotes } from '../hooks/useRoomNotes'
import { useNotesPanelCollapsed } from '../hooks/useNotesPanelCollapsed'

interface Props {
  roomPath: string
}

interface NoteDraft {
  title: string
  text: string
}

function emptyDraft(): NoteDraft {
  return { title: '', text: '' }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(target && (target as HTMLElement).closest('button, input, textarea, select, a'))
}

export default function RoomNotesPanel({ roomPath }: Props) {
  const { notes } = useRoomNotes()
  const { collapsed, toggleCollapsed } = useNotesPanelCollapsed(roomPath)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<NoteDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<NoteDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(emptyDraft())
  }

  function handleHeadClick(e: MouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(e.target)) return
    toggleCollapsed()
  }

  function handleToggleCollapsed() {
    if (!collapsed) {
      setAdding(false)
      setDraft(emptyDraft())
      cancelEdit()
      setError('')
    }
    toggleCollapsed()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await window.api.addRoomNote(draft.title, draft.text)
      setDraft(emptyDraft())
      setAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить заметку')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(note: RoomNote) {
    setEditingId(note.id)
    setEditDraft({ title: note.title, text: note.text })
    setError('')
  }

  async function handleUpdate(e: React.FormEvent, noteId: string) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await window.api.updateRoomNote(noteId, editDraft.title, editDraft.text)
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить заметку')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(noteId: string) {
    setBusy(true)
    setError('')
    try {
      await window.api.deleteRoomNote(noteId)
      if (editingId === noteId) cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить заметку')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`room-notes-panel ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Заметки комнаты"
    >
      <div
        className="room-notes-head"
        onClick={handleHeadClick}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggleCollapsed()
          }
        }}
      >
        <div className="room-notes-head-left">
          <button
            type="button"
            className="room-notes-collapse-toggle"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleCollapsed()
            }}
            aria-label={collapsed ? 'Развернуть заметки' : 'Свернуть заметки'}
          >
            <span className="room-notes-collapse-chevron" aria-hidden="true" />
          </button>
          <h2 className="room-notes-title">Заметки</h2>
          <span className="room-notes-count">{notes.length}</span>
        </div>
        {!collapsed && !adding && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setAdding(true)
              setDraft(emptyDraft())
              setError('')
            }}
          >
            + Заметка
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {error && <p className="room-notes-error">{error}</p>}

          <div className="room-notes-scroll">
            {adding && (
              <form className="room-note-card room-note-card--form" onSubmit={(e) => void handleAdd(e)}>
                <input
                  className="room-note-input room-note-input--title"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Название"
                  autoFocus
                  disabled={busy}
                />
                <textarea
                  className="room-note-input room-note-input--text"
                  value={draft.text}
                  onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                  placeholder="Текст заметки"
                  rows={3}
                  disabled={busy}
                />
                <div className="room-note-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setAdding(false)
                      setDraft(emptyDraft())
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}

            {notes.length === 0 && !adding && (
              <p className="room-notes-empty">Пока нет заметок — добавьте напоминание для отдела.</p>
            )}

            {notes.map((note) =>
              editingId === note.id ? (
                <form
                  key={note.id}
                  className="room-note-card room-note-card--form"
                  onSubmit={(e) => void handleUpdate(e, note.id)}
                >
                  <input
                    className="room-note-input room-note-input--title"
                    value={editDraft.title}
                    onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Название"
                    autoFocus
                    disabled={busy}
                  />
                  <textarea
                    className="room-note-input room-note-input--text"
                    value={editDraft.text}
                    onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
                    placeholder="Текст заметки"
                    rows={4}
                    disabled={busy}
                  />
                  <div className="room-note-actions">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                      Сохранить
                    </button>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={cancelEdit}>
                      Отмена
                    </button>
                  </div>
                </form>
              ) : (
                <article key={note.id} className="room-note-card">
                  <div className="room-note-card-body">
                    <h3 className="room-note-card-title">{note.title}</h3>
                    {note.text ? (
                      <p className="room-note-card-text">{note.text}</p>
                    ) : (
                      <p className="room-note-card-text room-note-card-text--empty">Без текста</p>
                    )}
                  </div>
                  <div className="room-note-actions room-note-actions--inline">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => startEdit(note)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm room-note-delete"
                      disabled={busy}
                      onClick={() => void handleDelete(note.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              )
            )}
          </div>
        </>
      )}
    </section>
  )
}
