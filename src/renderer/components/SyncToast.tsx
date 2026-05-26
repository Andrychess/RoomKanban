import type { SyncToastMessage } from '../hooks/useSyncNotifications'

interface Props {
  toast: SyncToastMessage | null
  onDismiss: () => void
}

export default function SyncToast({ toast, onDismiss }: Props) {
  if (!toast) return null

  return (
    <div className="sync-toast" role="status">
      <span>{toast.text}</span>
      <button type="button" className="sync-toast-close" onClick={onDismiss} aria-label="Закрыть">
        ×
      </button>
    </div>
  )
}
