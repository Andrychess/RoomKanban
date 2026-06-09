import type { TaskFile, TaskFileKind } from '../../shared/types'
import { TASK_FILE_GROUP_HINTS, TASK_FILE_GROUP_LABELS } from '../../shared/taskFiles'

export interface PendingFile {
  path: string
  name: string
}

export interface AttachmentLoadProgress {
  phase: 'message' | 'attachment'
  current: number
  total: number
  fileName: string
}

interface Props {
  kind: TaskFileKind
  existing: TaskFile[]
  pending: PendingFile[]
  removedIds: string[]
  taskId?: string
  onAdd: () => void
  onRemoveExisting: (fileId: string) => void
  onRemovePending: (path: string) => void
  onOpen?: (fileId: string) => void
  /** Запретить добавление файлов */
  disableAdd?: boolean
  /** Запретить удаление уже сохранённых файлов */
  disableRemoveExisting?: boolean
  /** Загрузка вложений из почты */
  loadingAttachments?: AttachmentLoadProgress | null
}

export default function TaskFileGroupEditor({
  kind,
  existing,
  pending,
  removedIds,
  taskId,
  onAdd,
  onRemoveExisting,
  onRemovePending,
  onOpen,
  disableAdd = false,
  disableRemoveExisting = false,
  loadingAttachments = null
}: Props) {
  const visibleExisting = existing.filter((f) => !removedIds.includes(f.id))

  return (
    <div className="task-file-group">
      <div className="task-file-group-head">
        <label>{TASK_FILE_GROUP_LABELS[kind]}</label>
        <span className="task-file-group-hint">{TASK_FILE_GROUP_HINTS[kind]}</span>
      </div>

      {visibleExisting.length === 0 && pending.length === 0 && !loadingAttachments && (
        <p className="task-file-group-empty">Файлов нет</p>
      )}

      {loadingAttachments && (
        <p className="task-file-group-loading" role="status">
          {loadingAttachments.phase === 'message'
            ? 'Загрузка письма…'
            : `Загрузка вложений ${loadingAttachments.current}/${loadingAttachments.total}: ${loadingAttachments.fileName}`}
        </p>
      )}

      <ul className="task-file-list">
        {visibleExisting.map((file) => (
          <li key={file.id} className="task-file-item">
            <span className="task-file-item-name" title={file.file_name}>
              📎 {file.file_name}
            </span>
            <span className="task-file-item-actions">
              {taskId && onOpen && (
                <button type="button" className="btn-link" onClick={() => onOpen(file.id)}>
                  Открыть
                </button>
              )}
              {!disableRemoveExisting && (
                <button
                  type="button"
                  className="btn-link danger"
                  onClick={() => onRemoveExisting(file.id)}
                >
                  Удалить
                </button>
              )}
            </span>
          </li>
        ))}
        {pending.map((file) => (
          <li key={file.path} className="task-file-item is-pending">
            <span className="task-file-item-name" title={file.name}>
              📎 {file.name}
              <span className="task-file-pending-badge">новый</span>
            </span>
            <button
              type="button"
              className="btn-link danger"
              onClick={() => onRemovePending(file.path)}
            >
              Убрать
            </button>
          </li>
        ))}
      </ul>

      {!disableAdd && (
        <button type="button" className="btn" onClick={onAdd}>
          + Добавить файл
        </button>
      )}
    </div>
  )
}
