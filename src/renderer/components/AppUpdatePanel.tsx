import type { AppUpdateStatus } from '../../shared/appUpdate'

interface Props {
  status: AppUpdateStatus | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

function getButtonLabel(status: AppUpdateStatus | null): string {
  if (!status?.enabled) return 'Обновление'
  switch (status.phase) {
    case 'checking':
      return 'Проверка…'
    case 'available':
      return 'Обновить'
    case 'downloading':
      return 'Загрузка…'
    case 'downloaded':
      return 'Установить'
    case 'not-available':
      return 'Обновить'
    case 'error':
      return 'Повторить'
    default:
      return 'Обновить'
  }
}

function hasUpdateReady(status: AppUpdateStatus | null): boolean {
  if (!status?.enabled) return false
  return status.phase === 'available' || status.phase === 'downloaded'
}

function isBusy(status: AppUpdateStatus | null): boolean {
  return status?.phase === 'checking' || status?.phase === 'downloading'
}

export default function AppUpdatePanel({ status, open, onClose, onUpdate }: Props) {
  const enabled = status?.enabled ?? false
  const busy = isBusy(status)
  const updateReady = hasUpdateReady(status)

  if (!open) {
    const hasError = status?.phase === 'error'
    return (
      <button
        type="button"
        className={`btn btn-ghost btn-sm app-update-trigger ${updateReady ? 'app-update-trigger--ready' : ''} ${hasError ? 'app-update-trigger--error' : ''}`}
        onClick={onUpdate}
        disabled={busy}
        title={status?.message ?? (enabled ? 'Проверить и установить обновление приложения' : 'Обновления доступны в установленной версии')}
      >
        {updateReady && <span className="app-update-dot" aria-hidden="true" />}
        {hasError && <span className="app-update-dot app-update-dot--error" aria-hidden="true" />}
        {getButtonLabel(status)}
        {status?.currentVersion && (
          <span className="app-update-version">v{status.currentVersion}</span>
        )}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="app-update-backdrop"
        aria-label="Закрыть окно обновления"
        onClick={onClose}
      />
      <div
        className="app-update-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-update-title"
        aria-describedby="app-update-lead"
      >
        <div className="app-update-panel-header">
          <h2 id="app-update-title">Обновление RoomKanban</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <p
          id="app-update-lead"
          className={`app-update-panel-lead ${status?.phase === 'error' ? 'app-update-panel-lead--error' : ''}`}
          role={status?.phase === 'error' ? 'alert' : undefined}
        >
          {status?.message ??
            (enabled
              ? 'Нажмите кнопку ниже — приложение само проверит, скачает и установит новую версию.'
              : 'Вы используете версию для разработки. Обновления работают в установленном приложении.')}
        </p>

        {status?.currentVersion && (
          <p className="app-update-panel-meta">
            Текущая версия: <strong>v{status.currentVersion}</strong>
            {status.availableVersion && status.phase !== 'not-available' && (
              <>
                {' '}
                → <strong>v{status.availableVersion}</strong>
              </>
            )}
          </p>
        )}

        {(status?.phase === 'downloading' || status?.phase === 'downloaded') && (
          <div className="app-update-progress" aria-label="Прогресс загрузки">
            <div
              className="app-update-progress-bar"
              style={{ width: `${status.progress ?? (status.phase === 'downloaded' ? 100 : 0)}%` }}
            />
          </div>
        )}

        <div className="app-update-panel-actions">
          <button
            type="button"
            className={`btn btn-primary btn-lg app-update-main-btn ${status?.phase === 'downloaded' ? 'app-update-main-btn--ready' : ''}`}
            onClick={onUpdate}
            disabled={busy}
          >
            {getButtonLabel(status)}
          </button>
          {!busy && status?.phase !== 'downloaded' && (
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Закрыть
            </button>
          )}
        </div>
      </div>
    </>
  )
}
