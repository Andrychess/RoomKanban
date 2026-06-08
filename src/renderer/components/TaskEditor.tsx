import { useEffect, useState } from 'react'
import type {
  CreateTaskInput,
  RoomState,
  Task,
  TaskType,
  UpdateTaskInput
} from '../../shared/types'
import { STATUS_LABELS_FULL, TASK_STATUSES } from '../../shared/taskStatus'
import { DEFAULT_PRIORITY_ID } from '../../shared/defaultTaskPriorities'
import { DEFAULT_TYPE_ID } from '../../shared/defaultTaskTypes'
import TaskDetailView from './TaskDetailView'
import TaskFileGroupEditor, { type PendingFile } from './TaskFileGroupEditor'
import TaskHistoryDialog from './TaskHistoryDialog'
import { mergeDueDateTime, splitDueDateTime } from '../utils/dates'
import TaskConflictDialog from './TaskConflictDialog'
import ConfirmDialog from './ConfirmDialog'
import TooltipWrap from './TooltipWrap'
import { TaskMetaRowEditor } from './TaskMetaRow'
import AutoResizeTextarea from './AutoResizeTextarea'
import { UI_HINTS } from '../hints/uiHints'
import { isTaskOverdue } from '../../shared/overdue'

export type TaskEditorMode = 'create' | 'edit' | 'view'

interface Props {
  roomState: RoomState
  currentPcId: string
  taskTypes: TaskType[]
  task: Task | null
  mode?: TaskEditorMode
  defaultStatus: Task['status']
  defaultDueDate?: string | null
  defaultAssigneePc?: string
  readOnlyArchived?: boolean
  onClose: () => void
  onSaved: () => void
}

function pathsToPending(paths: string[]): PendingFile[] {
  return paths.map((path) => ({
    path,
    name: path.split(/[/\\]/).pop() ?? path
  }))
}

export default function TaskEditor({
  roomState,
  currentPcId,
  taskTypes,
  task,
  mode: modeProp,
  defaultStatus,
  defaultDueDate = null,
  defaultAssigneePc,
  readOnlyArchived = false,
  onClose,
  onSaved
}: Props) {
  const [mode, setMode] = useState<TaskEditorMode>(() => modeProp ?? (task ? 'edit' : 'create'))
  const isCreate = mode === 'create'
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const employees = roomState.employees
  const pcIds = Object.keys(employees)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assigneePc, setAssigneePc] = useState(
    task?.assignee_pc ?? defaultAssigneePc ?? currentPcId
  )
  const [typeId, setTypeId] = useState(task?.type_id ?? taskTypes[0]?.id ?? DEFAULT_TYPE_ID)
  const [status, setStatus] = useState<Task['status']>(task?.status ?? defaultStatus)
  const initialDue = splitDueDateTime(task?.due_date ?? defaultDueDate ?? null)
  const [dueDatePart, setDueDatePart] = useState(initialDue.date)
  const [dueTimePart, setDueTimePart] = useState(initialDue.time)
  const [liveTask, setLiveTask] = useState<Task | null>(task)

  const [pendingSource, setPendingSource] = useState<PendingFile[]>([])
  const [pendingCompleted, setPendingCompleted] = useState<PendingFile[]>([])
  const [removedSourceIds, setRemovedSourceIds] = useState<string[]>([])
  const [removedCompletedIds, setRemovedCompletedIds] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conflictRemote, setConflictRemote] = useState<Task | null>(null)
  const [clientBaseUpdatedAt, setClientBaseUpdatedAt] = useState(task?.updated_at ?? 0)
  const [lockBlockedBy, setLockBlockedBy] = useState<string | null>(null)
  const [lockReady, setLockReady] = useState(!task)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setMode(modeProp ?? (task ? 'edit' : 'create'))
  }, [modeProp, task?.id])

  useEffect(() => {
    setLiveTask(task)
    setClientBaseUpdatedAt(task?.updated_at ?? 0)
    setConflictRemote(null)
    const parts = splitDueDateTime(task?.due_date ?? (task ? null : defaultDueDate))
    setDueDatePart(parts.date)
    setDueTimePart(parts.time)
  }, [task, defaultDueDate])

  function buildDueValue(): string | null {
    return mergeDueDateTime(dueDatePart, dueTimePart)
  }

  useEffect(() => {
    if (!task || readOnlyArchived || isView) {
      setLockReady(true)
      setLockBlockedBy(null)
      return
    }

    let cancelled = false
    setLockReady(false)
    setLockBlockedBy(null)

    void window.api.acquireTaskLock(task.id).then((result) => {
      if (cancelled) return
      if (!result.acquired && result.holder) {
        setLockBlockedBy(result.holder.employee_name)
      }
      setLockReady(true)
    })

    const interval = setInterval(() => {
      void window.api.refreshTaskLock(task.id)
    }, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      void window.api.releaseTaskLock(task.id)
    }
  }, [task?.id, readOnlyArchived, isView])

  useEffect(() => {
    if (!task && !assigneePc && pcIds.length > 0) setAssigneePc(currentPcId)
    if (!typeId && taskTypes[0]) setTypeId(taskTypes[0].id)
  }, [task, assigneePc, pcIds, currentPcId, typeId, taskTypes])

  function resolvePriorityId(): string {
    return liveTask?.priority_id ?? task?.priority_id ?? DEFAULT_PRIORITY_ID
  }

  async function pickFiles(target: 'source' | 'completed') {
    const paths = await window.api.selectTaskFiles()
    if (paths.length === 0) return
    const pending = pathsToPending(paths)
    if (target === 'source') {
      setPendingSource((prev) => [...prev, ...pending.filter((p) => !prev.some((x) => x.path === p.path))])
    } else {
      setPendingCompleted((prev) => [...prev, ...pending.filter((p) => !prev.some((x) => x.path === p.path))])
    }
  }

  function applyRemoteTask(remote: Task) {
    setTitle(remote.title)
    setDescription(remote.description)
    setAssigneePc(remote.assignee_pc)
    setTypeId(remote.type_id)
    setStatus(remote.status)
    const remoteDue = splitDueDateTime(remote.due_date)
    setDueDatePart(remoteDue.date)
    setDueTimePart(remoteDue.time)
    setLiveTask(remote)
    setClientBaseUpdatedAt(remote.updated_at)
    setPendingSource([])
    setPendingCompleted([])
    setRemovedSourceIds([])
    setRemovedCompletedIds([])
    setConflictRemote(null)
  }

  async function saveAttachmentsOnly(): Promise<boolean> {
    if (!task) return false
    const base = liveTask ?? task
    if (
      pendingSource.length === 0 &&
      pendingCompleted.length === 0 &&
      removedSourceIds.length === 0 &&
      removedCompletedIds.length === 0
    ) {
      return true
    }
    const input: UpdateTaskInput = {
      id: task.id,
      title: base.title,
      description: base.description,
      assignee_pc: base.assignee_pc,
      type_id: base.type_id,
      priority_id: base.priority_id,
      due_date: base.due_date,
      status: base.status,
      client_base_updated_at: clientBaseUpdatedAt,
      add_source_files: pendingSource.map((f) => f.path),
      add_completed_files: pendingCompleted.map((f) => f.path),
      remove_source_file_ids: [],
      remove_completed_file_ids: []
    }
    const result = await window.api.updateTask(input)
    if (result.status === 'conflict') {
      setConflictRemote(result.remoteTask)
      return false
    }
    setLiveTask(result.task)
    setClientBaseUpdatedAt(result.task.updated_at)
    setPendingSource([])
    setPendingCompleted([])
    setRemovedSourceIds([])
    setRemovedCompletedIds([])
    onSaved()
    return true
  }

  async function saveTask(forceOverwrite = false): Promise<boolean> {
    if (!task) return false
    const input: UpdateTaskInput = {
      id: task.id,
      title,
      description,
      assignee_pc: assigneePc,
      type_id: typeId,
      priority_id: resolvePriorityId(),
      due_date: buildDueValue(),
      status,
      client_base_updated_at: clientBaseUpdatedAt,
      force_overwrite: forceOverwrite || undefined,
      add_source_files: pendingSource.map((f) => f.path),
      add_completed_files: pendingCompleted.map((f) => f.path),
      remove_source_file_ids: removedSourceIds,
      remove_completed_file_ids: removedCompletedIds
    }
    const result = await window.api.updateTask(input)
    if (result.status === 'conflict') {
      setConflictRemote(result.remoteTask)
      return false
    }
    setLiveTask(result.task)
    onSaved()
    onClose()
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isCreate && (fieldsReadOnly || lockBlockedBy)) return
    if (!title.trim()) {
      setError('Укажите название')
      return
    }
    if (!assigneePc) {
      setError('Выберите ответственного')
      return
    }
    if (!typeId) {
      setError('Выберите вид задачи')
      return
    }

    setLoading(true)
    setError('')
    try {
      if (task) {
        const saved = await saveTask(false)
        if (!saved) return
      } else {
        const input: CreateTaskInput = {
          title,
          description,
          assignee_pc: assigneePc,
          type_id: typeId,
          priority_id: resolvePriorityId(),
          due_date: buildDueValue(),
          status,
          add_source_files: pendingSource.map((f) => f.path),
          add_completed_files: pendingCompleted.map((f) => f.path)
        }
        await window.api.createTask(input)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  const fieldsReadOnly = Boolean(readOnlyArchived || isView || (isEdit && lockBlockedBy))
  const formDisabled = fieldsReadOnly || !lockReady || loading
  const detailTask = liveTask ?? task
  const hasPendingFiles =
    pendingSource.length > 0 ||
    pendingCompleted.length > 0 ||
    removedSourceIds.length > 0 ||
    removedCompletedIds.length > 0

  const duePreviewOverdue = isTaskOverdue({
    due_date: buildDueValue(),
    status
  } as Task)

  const editorTitle = isCreate
    ? 'Новая задача'
    : readOnlyArchived
      ? 'Архив: задача'
      : isView
        ? 'Подробнее о задаче'
        : 'Редактирование'

  const canDelete = Boolean(task && !readOnlyArchived && !isCreate)

  async function confirmDelete() {
    if (!task) return
    setDeleting(true)
    setError('')
    try {
      await window.api.releaseTaskLock(task.id)
      await window.api.deleteTask(task.id)
      setDeleteOpen(false)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить задачу')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  function renderHistoryButton(disabled = false) {
    if (!task || isCreate) return null
    return (
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled || deleting}
        onClick={() => setHistoryOpen(true)}
      >
        История
      </button>
    )
  }

  function renderEditButton(disabled = false) {
    if (readOnlyArchived || isCreate || !isView) return null
    return (
      <TooltipWrap text={UI_HINTS.taskCard.edit}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || deleting}
          onClick={() => setMode('edit')}
        >
          Редактировать
        </button>
      </TooltipWrap>
    )
  }

  function renderDeleteButton(disabled = false) {
    if (!canDelete) return null
    return (
      <TooltipWrap text={UI_HINTS.taskEditor.delete}>
        <button
          type="button"
          className="btn btn-danger"
          disabled={disabled || deleting}
          onClick={() => setDeleteOpen(true)}
        >
          Удалить
        </button>
      </TooltipWrap>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {historyOpen && task && (
        <TaskHistoryDialog
          taskId={task.id}
          taskTitle={task.title}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {deleteOpen && task && (
        <ConfirmDialog
          title="Удалить задачу?"
          message={`«${task.title}» будет удалена безвозвратно вместе с прикреплёнными файлами и историей изменений.`}
          confirmLabel="Удалить"
          danger
          loading={deleting}
          onCancel={() => !deleting && setDeleteOpen(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
      {conflictRemote && (
        <TaskConflictDialog
          remoteTask={conflictRemote}
          busy={loading}
          onCancel={() => setConflictRemote(null)}
          onReload={() => applyRemoteTask(conflictRemote)}
          onOverwrite={() => {
            setLoading(true)
            setError('')
            void saveTask(true)
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Ошибка сохранения')
              })
              .finally(() => setLoading(false))
          }}
        />
      )}
      <div
        className={`modal card task-editor-modal ${isView ? 'task-editor-modal-view' : 'task-editor-modal-wide'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        {!isView && <h2 id="task-editor-title">{editorTitle}</h2>}

        {isEdit && task && !readOnlyArchived && !lockReady && (
          <p className="sub">Проверка доступа к задаче…</p>
        )}

        {isEdit && lockBlockedBy && (
          <div className="info-box task-lock-warn">
            Сейчас редактирует: <strong>{lockBlockedBy}</strong>. Откройте «Подробнее», чтобы добавить
            файлы.
          </div>
        )}

        {readOnlyArchived && (
          <div className="info-box">Задача в архиве — только просмотр. Верните на доску из раздела «Архив».</div>
        )}

        {error && <div className="error">{error}</div>}

        {isView && task && detailTask ? (
          <div className="task-editor-view-body">
            <TaskDetailView
              task={detailTask}
              roomState={roomState}
              taskTypes={taskTypes}
            />

            <section className="task-detail-block task-detail-files">
              <h3 className="task-detail-block-title">Документы</h3>
              <p className="task-detail-files-hint">
                Можно прикрепить файлы без редактирования задачи.
              </p>
              <div className="task-file-groups-row">
                <TaskFileGroupEditor
                  kind="source"
                  existing={detailTask.source_files}
                  pending={pendingSource}
                  removedIds={removedSourceIds}
                  taskId={task.id}
                  disableAdd={readOnlyArchived}
                  disableRemoveExisting
                  onAdd={() => void pickFiles('source')}
                  onRemoveExisting={(id) => setRemovedSourceIds((prev) => [...prev, id])}
                  onRemovePending={(path) =>
                    setPendingSource((prev) => prev.filter((f) => f.path !== path))
                  }
                  onOpen={(fileId) => void window.api.openTaskFile(task.id, 'source', fileId)}
                />
                <TaskFileGroupEditor
                  kind="completed"
                  existing={detailTask.completed_files}
                  pending={pendingCompleted}
                  removedIds={removedCompletedIds}
                  taskId={task.id}
                  disableAdd={readOnlyArchived}
                  disableRemoveExisting
                  onAdd={() => void pickFiles('completed')}
                  onRemoveExisting={(id) => setRemovedCompletedIds((prev) => [...prev, id])}
                  onRemovePending={(path) =>
                    setPendingCompleted((prev) => prev.filter((f) => f.path !== path))
                  }
                  onOpen={(fileId) => void window.api.openTaskFile(task.id, 'completed', fileId)}
                />
              </div>
            </section>

            <div className="actions-row task-editor-view-actions">
              {renderDeleteButton(loading)}
              <div className="task-editor-actions-main">
                {renderHistoryButton(loading)}
                {renderEditButton(loading)}
              <button type="button" className="btn" onClick={onClose} disabled={loading || deleting}>
                {hasPendingFiles ? 'Отмена' : 'Закрыть'}
              </button>
              {hasPendingFiles && (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true)
                    setError('')
                    void saveAttachmentsOnly()
                      .catch((err) => {
                        setError(err instanceof Error ? err.message : 'Ошибка сохранения файлов')
                      })
                      .finally(() => setLoading(false))
                  }}
                >
                  {loading ? 'Сохранение…' : 'Сохранить файлы'}
                </button>
              )}
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmit(e)
            }}
          >
            <fieldset className="task-editor-fieldset" disabled={formDisabled}>
              <div className="form-group task-editor-title-group">
                <label htmlFor="taskTitle">Название</label>
                <input
                  id="taskTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название задачи"
                  autoFocus={isEdit && !fieldsReadOnly}
                />
                <TaskMetaRowEditor
                  employees={employees}
                  pcIds={pcIds}
                  assigneePc={assigneePc}
                  dueDatePart={dueDatePart}
                  dueTimePart={dueTimePart}
                  overdue={duePreviewOverdue}
                  disabled={formDisabled}
                  onAssigneeChange={setAssigneePc}
                  onDueDateChange={setDueDatePart}
                  onDueTimeChange={setDueTimePart}
                  onClearDue={() => {
                    setDueDatePart('')
                    setDueTimePart('')
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="taskType">Вид задачи</label>
                <select id="taskType" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  {taskTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="taskDescription">Описание</label>
                <AutoResizeTextarea
                  id="taskDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ТЗ, контекст, что нужно сделать…"
                  minRows={3}
                  maxRows={18}
                  disabled={formDisabled}
                />
              </div>

              <div className="form-group">
                <label htmlFor="taskStatus">На каком этапе</label>
                <select
                  id="taskStatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Task['status'])}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS_FULL[s]}
                    </option>
                  ))}
                </select>
              </div>

              <details className="task-editor-section" open>
                <summary>Документы к задаче</summary>
                <div className="task-editor-section-body">
                  <div className="task-file-groups-row">
                    <TaskFileGroupEditor
                      kind="source"
                      existing={detailTask?.source_files ?? []}
                      pending={pendingSource}
                      removedIds={removedSourceIds}
                      taskId={task?.id}
                      disableAdd={readOnlyArchived}
                      disableRemoveExisting={readOnlyArchived}
                      onAdd={() => void pickFiles('source')}
                      onRemoveExisting={(id) => setRemovedSourceIds((prev) => [...prev, id])}
                      onRemovePending={(path) =>
                        setPendingSource((prev) => prev.filter((f) => f.path !== path))
                      }
                      onOpen={
                        task
                          ? (fileId) => void window.api.openTaskFile(task.id, 'source', fileId)
                          : undefined
                      }
                    />
                    <TaskFileGroupEditor
                      kind="completed"
                      existing={detailTask?.completed_files ?? []}
                      pending={pendingCompleted}
                      removedIds={removedCompletedIds}
                      taskId={task?.id}
                      disableAdd={readOnlyArchived}
                      disableRemoveExisting={readOnlyArchived}
                      onAdd={() => void pickFiles('completed')}
                      onRemoveExisting={(id) => setRemovedCompletedIds((prev) => [...prev, id])}
                      onRemovePending={(path) =>
                        setPendingCompleted((prev) => prev.filter((f) => f.path !== path))
                      }
                      onOpen={
                        task
                          ? (fileId) => void window.api.openTaskFile(task.id, 'completed', fileId)
                          : undefined
                      }
                    />
                  </div>
                </div>
              </details>
            </fieldset>

            <div className="actions-row task-editor-actions">
              {renderDeleteButton(formDisabled)}
              <div className="task-editor-actions-main">
                {renderHistoryButton(formDisabled)}
                <button type="button" className="btn" onClick={onClose} disabled={loading || deleting}>
                  {fieldsReadOnly && !hasPendingFiles ? 'Закрыть' : 'Отмена'}
                </button>
                {isEdit && !lockBlockedBy && (
                  <button type="submit" className="btn btn-primary btn-lg" disabled={formDisabled || deleting}>
                    {loading ? 'Сохранение…' : 'Сохранить'}
                  </button>
                )}
                {isCreate && (
                  <button type="submit" className="btn btn-primary btn-lg" disabled={formDisabled || deleting}>
                    {loading ? 'Сохранение…' : 'Создать'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
