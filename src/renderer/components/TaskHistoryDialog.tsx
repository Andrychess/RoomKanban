import TaskHistoryPanel from './TaskHistoryPanel'

interface Props {
  taskId: string
  taskTitle: string
  onClose: () => void
}

export default function TaskHistoryDialog({ taskId, taskTitle, onClose }: Props) {
  return (
    <div className="modal-overlay task-history-overlay" onClick={onClose}>
      <div
        className="modal card task-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-history-dialog-header">
          <div>
            <h2 id="task-history-title">История изменений</h2>
            <p className="task-history-dialog-sub">{taskTitle}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="task-history-dialog-body">
          <TaskHistoryPanel taskId={taskId} showTitle={false} />
        </div>
        <div className="actions-row task-history-dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
