import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DepartmentMailInboxData,
  DepartmentMailMessage,
  DepartmentMailMessageStatus,
  MailTaskDraftProgress
} from '../../shared/departmentMail'
import type { Room, Task } from '../../shared/types'
import DepartmentMailConnectionModal from '../components/DepartmentMailConnectionModal'
import DepartmentMailMessageModal from '../components/DepartmentMailMessageModal'
import DepartmentMailMessageTile from '../components/DepartmentMailMessageTile'
import TaskEditor from '../components/TaskEditor'
import type { AttachmentLoadProgress, PendingFile } from '../components/TaskFileGroupEditor'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  onTasksChanged?: () => void
}

const MAIL_COLUMNS: {
  status: DepartmentMailMessageStatus
  title: string
  empty: string
}[] = [
  { status: 'pending', title: 'В очереди', empty: 'Нет писем в очереди' },
  { status: 'discarded', title: 'Отброшенные', empty: 'Нет отброшенных писем' },
  { status: 'task_created', title: 'Ушли в работу', empty: 'Пока нет задач из писем' }
]

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMailDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function buildDraftDescription(message: DepartmentMailMessage, bodyText: string): string {
  return [`Письмо от: ${message.from}`, `Дата: ${formatMailDate(message.date)}`, '', bodyText]
    .filter((line, index) => index < 3 || line.length > 0)
    .join('\n')
}

function draftProgressToUi(progress: MailTaskDraftProgress): AttachmentLoadProgress {
  return {
    phase: progress.phase,
    current: progress.current,
    total: progress.total,
    fileName: progress.file_name
  }
}

interface MailTaskEditorState {
  messageId: string
  title: string
  description: string
  assigneePc: string
  pendingSource: PendingFile[]
  attachmentLoadProgress: AttachmentLoadProgress | null
}

export default function DepartmentMailScreen({ room, onTasksChanged }: Props) {
  const { types: taskTypes } = useTaskTypes()
  const [inbox, setInbox] = useState<DepartmentMailInboxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => formatLocalYmd(new Date()))
  const [dateTo, setDateTo] = useState(() => formatLocalYmd(new Date()))
  const [fetchInfo, setFetchInfo] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [bodyLoading, setBodyLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [openingAttachmentIndex, setOpeningAttachmentIndex] = useState<number | null>(null)
  const [mailTaskEditor, setMailTaskEditor] = useState<MailTaskEditorState | null>(null)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const [data, pwd] = await Promise.all([
        window.api.getDepartmentMailInbox(),
        window.api.getDepartmentMailHasPassword()
      ])
      setInbox(data)
      setHasPassword(pwd)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  const messagesByStatus = useMemo(() => {
    const all = inbox?.messages ?? []
    const sortNewest = (items: DepartmentMailMessage[]) =>
      [...items].sort((a, b) => b.date.localeCompare(a.date))
    return {
      pending: sortNewest(all.filter((m) => m.status === 'pending')),
      discarded: sortNewest(all.filter((m) => m.status === 'discarded')),
      task_created: sortNewest(all.filter((m) => m.status === 'task_created'))
    }
  }, [inbox])

  const selected = useMemo(
    () => inbox?.messages.find((m) => m.id === selectedId) ?? null,
    [inbox, selectedId]
  )

  useEffect(() => {
    if (!selected) {
      setBody('')
      return
    }
    let cancelled = false
    setBodyLoading(true)
    void window.api
      .getDepartmentMailMessageBody(selected.id)
      .then(({ body: text }) => {
        if (!cancelled) setBody(text)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBody(err instanceof Error ? err.message : 'Не удалось загрузить текст письма')
        }
      })
      .finally(() => {
        if (!cancelled) setBodyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  async function fetchPeriod(from: string, to: string) {
    setFetching(true)
    setFetchInfo(null)
    try {
      const result = await window.api.fetchDepartmentMailForPeriod({
        date_from: from,
        date_to: to
      })
      setInbox(result.inbox)
      const parts = [`Добавлено писем: ${result.added_count}`]
      if (result.skipped_known > 0) {
        parts.push(`уже в списке: ${result.skipped_known}`)
      }
      const notLoaded = result.total_matched - result.added_count - result.skipped_known
      if (notLoaded > 0) {
        parts.push(`на сервере за период: ${result.total_matched}, не загружено: ${notLoaded}`)
      } else if (result.total_matched > 0 && result.added_count === 0 && result.skipped_known === 0) {
        parts.push(`на сервере за период: ${result.total_matched}`)
      }
      if (result.truncated) {
        parts.push(`показаны последние ${result.added_count} (лимит за один раз)`)
      }
      setFetchInfo(parts.join(' · '))
      if (result.added_count > 0 && !selectedId) {
        const first = result.inbox.messages.find((m) => m.status === 'pending')
        if (first) setSelectedId(first.id)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось загрузить письма')
    } finally {
      setFetching(false)
    }
  }

  function fetchToday() {
    const today = formatLocalYmd(new Date())
    setDateFrom(today)
    setDateTo(today)
    void fetchPeriod(today, today)
  }

  async function openMailAttachment(message: DepartmentMailMessage, attachmentIndex: number) {
    setOpeningAttachmentIndex(attachmentIndex)
    try {
      await window.api.openDepartmentMailAttachment(message.id, attachmentIndex)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть вложение')
    } finally {
      setOpeningAttachmentIndex(null)
    }
  }

  async function discardMessage(message: DepartmentMailMessage) {
    setActionLoading(true)
    try {
      const next = await window.api.discardDepartmentMailMessage(message.id)
      setInbox(next)
      setSelectedId(message.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось отбросить письмо')
    } finally {
      setActionLoading(false)
    }
  }

  function openTaskFromMail(message: DepartmentMailMessage) {
    setMailTaskEditor({
      messageId: message.id,
      title: message.subject,
      description: buildDraftDescription(message, body),
      assigneePc: room.state.chief_pc,
      pendingSource: [],
      attachmentLoadProgress: {
        phase: 'message',
        current: 0,
        total: Math.max(1, message.attachment_count),
        fileName: 'Письмо…'
      }
    })

    const unsub = window.api.subscribeDepartmentMailDraftProgress((progress) => {
      if (progress.message_id !== message.id) return
      setMailTaskEditor((prev) =>
        prev?.messageId === message.id
          ? { ...prev, attachmentLoadProgress: draftProgressToUi(progress) }
          : prev
      )
    })

    void window.api
      .prepareDepartmentMailTaskDraft(message.id)
      .then((draft) => {
        setMailTaskEditor((prev) =>
          prev?.messageId === message.id
            ? {
                ...prev,
                title: draft.title,
                description: draft.description,
                assigneePc: draft.assignee_pc,
                pendingSource: draft.source_files.map((file) => ({
                  path: file.path,
                  name: file.name
                })),
                attachmentLoadProgress: null
              }
            : prev
        )
      })
      .catch((err: unknown) => {
        alert(err instanceof Error ? err.message : 'Не удалось подготовить задачу из письма')
        void window.api.cancelDepartmentMailTaskDraft(message.id)
        setMailTaskEditor(null)
      })
      .finally(() => unsub())
  }

  async function closeMailTaskEditor() {
    if (mailTaskEditor) {
      await window.api.cancelDepartmentMailTaskDraft(mailTaskEditor.messageId)
    }
    setMailTaskEditor(null)
  }

  async function handleMailTaskCreated(task: Task) {
    if (!mailTaskEditor) return
    const messageId = mailTaskEditor.messageId
    const next = await window.api.markDepartmentMailMessageTaskCreated(messageId, task.id)
    setInbox(next)
    setSelectedId(messageId)
    setMailTaskEditor(null)
    onTasksChanged?.()
  }

  if (loading && !inbox) {
    return (
      <div className="department-mail-page">
        <p className="sub">Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="department-mail-page department-mail-workspace">
      <header className="department-mail-topbar">
        <div className="department-mail-topbar-title">
          <h2>Почта отдела</h2>
          {!hasPassword && (
            <p className="department-mail-topbar-warning error-text" role="status">
              Сохраните пароль в настройках подключения
            </p>
          )}
        </div>

        <div className="department-mail-toolbar">
          <label className="form-group department-mail-toolbar-field">
            <span>С</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="form-group department-mail-toolbar-field">
            <span>По</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <div className="department-mail-toolbar-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={fetching || !hasPassword}
              onClick={() => void fetchPeriod(dateFrom, dateTo)}
            >
              {fetching ? 'Загрузка…' : 'За период'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={fetching || !hasPassword}
              onClick={() => void fetchToday()}
            >
              Сегодня
            </button>
          </div>
          {fetchInfo && <p className="department-mail-fetch-info">{fetchInfo}</p>}
        </div>

        <button
          type="button"
          className="btn department-mail-settings-btn"
          onClick={() => setConnectionOpen(true)}
        >
          Настройки
        </button>
      </header>

      <div className="department-mail-board">
        {MAIL_COLUMNS.map((column) => {
          const items = messagesByStatus[column.status]
          return (
            <section
              key={column.status}
              className={`dashboard-section department-mail-column department-mail-column--${column.status}`}
            >
              <h3 className="department-mail-column-title">
                {column.title}
                <span className="department-mail-count">{items.length}</span>
              </h3>
              <div className="department-mail-column-body">
                {items.length === 0 ? (
                  <p className="sub department-mail-column-empty">{column.empty}</p>
                ) : (
                  <div className="department-mail-tiles">
                    {items.map((message) => (
                      <DepartmentMailMessageTile
                        key={message.id}
                        message={message}
                        selected={selectedId === message.id}
                        formatDate={formatMailDate}
                        onSelect={() => setSelectedId(message.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {selected && (
        <DepartmentMailMessageModal
          message={selected}
          body={body}
          bodyLoading={bodyLoading}
          actionLoading={actionLoading}
          taskEditorOpen={Boolean(mailTaskEditor)}
          openingAttachmentIndex={openingAttachmentIndex}
          formatDate={formatMailDate}
          onClose={() => setSelectedId(null)}
          onCreateTask={() => openTaskFromMail(selected)}
          onDiscard={() => void discardMessage(selected)}
          onOpenAttachment={
            selected.status === 'pending'
              ? (index) => void openMailAttachment(selected, index)
              : undefined
          }
        />
      )}

      {mailTaskEditor && (
        <TaskEditor
          roomState={room.state}
          currentPcId={room.pcId}
          taskTypes={taskTypes}
          task={null}
          defaultStatus="review"
          defaultTitle={mailTaskEditor.title}
          defaultDescription={mailTaskEditor.description}
          defaultAssigneePc={mailTaskEditor.assigneePc}
          initialPendingSource={mailTaskEditor.pendingSource}
          attachmentLoadProgress={mailTaskEditor.attachmentLoadProgress}
          onClose={() => void closeMailTaskEditor()}
          onSaved={() => {}}
          onCreated={(task) => void handleMailTaskCreated(task)}
        />
      )}

      {connectionOpen && (
        <DepartmentMailConnectionModal
          onClose={() => {
            setConnectionOpen(false)
            void loadInbox()
          }}
        />
      )}
    </div>
  )
}
