import type { Task } from '../../shared/types'

interface Props {
  remoteTask: Task
  onReload: () => void
  onOverwrite: () => void
  onCancel: () => void
  busy?: boolean
}

export default function TaskConflictDialog({
  remoteTask,
  onReload,
  onOverwrite,
  onCancel,
  busy = false
}: Props) {
  return (
    <div className="modal-overlay task-conflict-overlay" onClick={onCancel}>
      <div className="modal card task-conflict-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Конфликт синхронизации</h3>
        <p>
          Задача «<strong>{remoteTask.title}</strong>» была изменена на другом компьютере, пока вы
          редактировали её.
        </p>
        <p className="sub">Выберите: подставить версию с диска или сохранить ваши правки поверх.</p>
        <div className="actions-row">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="btn" onClick={onReload} disabled={busy}>
            Взять с диска
          </button>
          <button type="button" className="btn btn-primary" onClick={onOverwrite} disabled={busy}>
            Сохранить мои правки
          </button>
        </div>
      </div>
    </div>
  )
}
