import { useEffect } from 'react'
import type { DepartmentMailMessage } from '../../shared/departmentMail'

interface Props {
  message: DepartmentMailMessage
  body: string
  bodyLoading: boolean
  actionLoading: boolean
  taskEditorOpen: boolean
  openingAttachmentIndex: number | null
  formatDate: (iso: string) => string
  onClose: () => void
  onCreateTask: () => void
  onDiscard: () => void
  onOpenAttachment?: (attachmentIndex: number) => void
}

const STATUS_LABELS: Record<DepartmentMailMessage['status'], string> = {
  pending: 'В очереди',
  discarded: 'Отброшено',
  task_created: 'Ушло в работу'
}

function attachmentLabel(count: number): string {
  if (count === 0) return 'Нет вложений'
  if (count === 1) return '1 файл'
  if (count >= 2 && count <= 4) return `${count} файла`
  return `${count} файлов`
}

export default function DepartmentMailMessageModal({
  message,
  body,
  bodyLoading,
  actionLoading,
  taskEditorOpen,
  openingAttachmentIndex,
  formatDate,
  onClose,
  onCreateTask,
  onDiscard,
  onOpenAttachment
}: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !taskEditorOpen) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, taskEditorOpen])

  return (
    <div className="modal-overlay department-mail-message-overlay" onClick={onClose}>
      <div
        className="modal card department-mail-message-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-mail-message-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="department-mail-message-header">
          <div className="department-mail-message-header-main">
            <span
              className={`department-mail-status-pill department-mail-status-pill--${message.status}`}
            >
              {STATUS_LABELS[message.status]}
            </span>
            <h2 id="department-mail-message-title">{message.subject}</h2>
          </div>
          <button
            type="button"
            className="btn department-mail-message-close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <dl className="department-mail-message-meta">
          <div className="department-mail-message-meta-item">
            <dt>От</dt>
            <dd>{message.from}</dd>
          </div>
          <div className="department-mail-message-meta-item">
            <dt>Дата</dt>
            <dd>{formatDate(message.date)}</dd>
          </div>
          <div className="department-mail-message-meta-item">
            <dt>Вложения</dt>
            <dd>{attachmentLabel(message.attachment_count)}</dd>
          </div>
          {message.status === 'task_created' && message.task_id ? (
            <div className="department-mail-message-meta-item">
              <dt>Задача</dt>
              <dd className="department-mail-message-task-id">{message.task_id}</dd>
            </div>
          ) : null}
        </dl>

        {message.attachment_names.length > 0 && (
          <div className="department-mail-message-attachments">
            {message.attachment_names.map((name, index) => {
              const canOpen = message.status === 'pending' && Boolean(onOpenAttachment)
              const loading = openingAttachmentIndex === index
              const Tag = canOpen ? 'button' : 'span'

              return (
                <Tag
                  key={`${name}-${index}`}
                  type={canOpen ? 'button' : undefined}
                  className={`department-mail-attachment-chip ${canOpen ? 'department-mail-attachment-chip--action' : ''} ${loading ? 'department-mail-attachment-chip--loading' : ''}`}
                  title={canOpen ? `Открыть: ${name}` : name}
                  disabled={canOpen ? loading || actionLoading || taskEditorOpen : undefined}
                  onClick={canOpen ? () => onOpenAttachment?.(index) : undefined}
                >
                  {loading ? '⏳' : '📎'} {name}
                </Tag>
              )
            })}
          </div>
        )}

        <div className="department-mail-message-body">
          {bodyLoading ? (
            <p className="sub">Загрузка текста…</p>
          ) : (
            <pre>{body || '(Текст письма пуст или только HTML без текста)'}</pre>
          )}
        </div>

        {message.status === 'pending' && (
          <footer className="department-mail-message-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionLoading || taskEditorOpen}
              onClick={onCreateTask}
            >
              Сформировать задачу
            </button>
            <button
              type="button"
              className="btn"
              disabled={actionLoading}
              onClick={onDiscard}
            >
              Отбросить
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
