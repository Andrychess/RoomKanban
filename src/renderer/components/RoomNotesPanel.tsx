import { useEffect, useRef, useState } from 'react'
import type { RoomNote } from '../../shared/types'
import { useRoomNotes } from '../hooks/useRoomNotes'
import { useNotesPanelCollapsed } from '../hooks/useNotesPanelCollapsed'
import TooltipWrap from './TooltipWrap'

interface Props {
  roomPath: string
  /** В одной строке с вкладками «Задачи» / «Календарь». */
  inline?: boolean
  /** Не показывать кнопку «Заметки» — открытие только из меню. */
  hideTab?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface NoteDraft {
  title: string
  text: string
}

function emptyDraft(): NoteDraft {
  return { title: '', text: '' }
}

export default function RoomNotesPanel({
  roomPath,
  inline = false,
  hideTab = false,
  open: openControlled,
  onOpenChange
}: Props) {
  const { notes } = useRoomNotes()
  const { collapsed: collapsedStored, toggleCollapsed, setCollapsed } = useNotesPanelCollapsed(roomPath)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<NoteDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<NoteDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const expanded = inline
    ? (openControlled ?? false)
    : !collapsedStored

  useEffect(() => {
    if (!inline || !expanded) return

    function handlePointerDown(event: Event) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onOpenChange?.(false)
        setCollapsed(true)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange?.(false)
        setCollapsed(true)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded, inline, onOpenChange, setCollapsed])

  function setExpanded(next: boolean) {
    if (inline) {
      onOpenChange?.(next)
      setCollapsed(!next)
      return
    }
    if (next === expanded) return
    toggleCollapsed()
  }

  function handleToggleExpanded() {
    if (expanded) {
      setAdding(false)
      setDraft(emptyDraft())
      cancelEdit()
      setError('')
    }
    setExpanded(!expanded)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(emptyDraft())
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

  const notesBody = (
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
  )

  if (inline) {
    return (
      <div
        className={`room-notes-inline ${hideTab ? 'room-notes-inline--menu' : ''}`}
        ref={panelRef}
      >
        {!hideTab && (
          <TooltipWrap text="Общие заметки отдела — напоминания и важная информация">
            <button
              type="button"
              className={`room-tab room-notes-tab ${expanded ? 'active is-open' : ''}`}
              aria-expanded={expanded}
              aria-haspopup="dialog"
              onClick={handleToggleExpanded}
            >
              Заметки
              <span className="room-notes-count">{notes.length}</span>
            </button>
          </TooltipWrap>
        )}

        {expanded && (
          <div className="room-notes-popover" role="dialog" aria-label="Заметки комнаты">
            <div className="room-notes-popover-head">
              <span className="room-notes-popover-title">Заметки</span>
              {!adding && (
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
            {notesBody}
          </div>
        )}
      </div>
    )
  }

  return (
    <section
      className={`room-notes-panel ${expanded ? '' : 'is-collapsed'}`}
      aria-label="Заметки комнаты"
    >
      <div
        className="room-notes-head"
        onClick={handleToggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggleExpanded()
          }
        }}
      >
        <div className="room-notes-head-left">
          <button
            type="button"
            className="room-notes-collapse-toggle"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleExpanded()
            }}
            aria-label={expanded ? 'Свернуть заметки' : 'Развернуть заметки'}
          >
            <span className="room-notes-collapse-chevron" aria-hidden="true" />
          </button>
          <h2 className="room-notes-title">Заметки</h2>
          <span className="room-notes-count">{notes.length}</span>
        </div>
        {expanded && !adding && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              setAdding(true)
              setDraft(emptyDraft())
              setError('')
            }}
          >
            + Заметка
          </button>
        )}
      </div>

      {expanded && notesBody}
    </section>
  )
}
