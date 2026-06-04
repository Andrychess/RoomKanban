import { useEffect, useState } from 'react'
import type {
  ChecklistItem,
  CreateTaskInput,
  RoomState,
  Task,
  TaskPriority,
  TaskType,
  UpdateTaskInput
} from '../../shared/types'
import { STATUS_LABELS_FULL, TASK_STATUSES } from '../../shared/taskStatus'
import { DEFAULT_PRIORITY_ID } from '../../shared/defaultTaskPriorities'
import { DEFAULT_TYPE_ID } from '../../shared/defaultTaskTypes'
import TaskChecklist from './TaskChecklist'
import TaskComments from './TaskComments'
import TaskDetailView from './TaskDetailView'
import TaskFileGroupEditor, { type PendingFile } from './TaskFileGroupEditor'
import TaskHistoryPanel from './TaskHistoryPanel'
import { mergeDueDateTime, splitDueDateTime } from '../utils/dates'
import TaskTemplatePicker, { type TemplateApplyValues } from './TaskTemplatePicker'
import TaskConflictDialog from './TaskConflictDialog'
import { useTaskTemplates } from '../hooks/useTaskTemplates'

export type TaskEditorMode = 'create' | 'edit' | 'view'

interface Props {
  roomState: RoomState
  currentPcId: string
  taskTypes: TaskType[]
  taskPriorities: TaskPriority[]
  task: Task | null
  mode?: TaskEditorMode
  defaultStatus: Task['status']
  defaultDueDate?: string | null
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
  taskPriorities,
  task,
  mode: modeProp,
  defaultStatus,
  defaultDueDate = null,
  readOnlyArchived = false,
  onClose,
  onSaved
}: Props) {
  const mode: TaskEditorMode = modeProp ?? (task ? 'edit' : 'create')
  const isCreate = mode === 'create'
  const isView = mode === 'view'
  const isEdit = mode === 'edit'
  const { templates } = useTaskTemplates()
  const employees = roomState.employees
  const pcIds = Object.keys(employees)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assigneePc, setAssigneePc] = useState(task?.assignee_pc ?? currentPcId)
  const [typeId, setTypeId] = useState(task?.type_id ?? taskTypes[0]?.id ?? DEFAULT_TYPE_ID)
  const [priorityId, setPriorityId] = useState(
    task?.priority_id ?? taskPriorities[0]?.id ?? DEFAULT_PRIORITY_ID
  )
  const [status, setStatus] = useState<Task['status']>(task?.status ?? defaultStatus)
  const initialDue = splitDueDateTime(task?.due_date ?? defaultDueDate ?? null)
  const [dueDatePart, setDueDatePart] = useState(initialDue.date)
  const [dueTimePart, setDueTimePart] = useState(initialDue.time)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? [])
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
    if (!priorityId && taskPriorities[0]) setPriorityId(taskPriorities[0].id)
  }, [task, assigneePc, pcIds, currentPcId, typeId, taskTypes, priorityId, taskPriorities])

  function applyTemplate(values: TemplateApplyValues) {
    setTitle(values.title)
    setDescription(values.description)
    setTypeId(values.typeId)
    setPriorityId(values.priorityId)
    setStatus(values.status)
    const tplDue = splitDueDateTime(values.dueDate || null)
    setDueDatePart(tplDue.date)
    setDueTimePart(tplDue.time)
    setChecklist(values.checklist)
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
    setPriorityId(remote.priority_id)
    setStatus(remote.status)
    const remoteDue = splitDueDateTime(remote.due_date)
    setDueDatePart(remoteDue.date)
    setDueTimePart(remoteDue.time)
    setChecklist(remote.checklist)
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
      checklist: base.checklist,
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
      priority_id: priorityId,
      due_date: buildDueValue(),
      status,
      checklist,
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
    if (!priorityId) {
      setError('Выберите приоритет')
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
          priority_id: priorityId,
          due_date: buildDueValue(),
          status,
          checklist,
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
  const commentsTask = liveTask ?? task
  const hasPendingFiles =
    pendingSource.length > 0 ||
    pendingCompleted.length > 0 ||
    removedSourceIds.length > 0 ||
    removedCompletedIds.length > 0

  const editorTitle = isCreate
    ? 'Новая задача'
    : readOnlyArchived
      ? 'Архив: задача'
      : isView
        ? 'Подробнее о задаче'
        : 'Редактирование'

  return (
    <div className="modal-overlay" onClick={onClose}>
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

        {!task && templates.length > 0 && (
          <TaskTemplatePicker templates={templates} onApply={applyTemplate} />
        )}

        {isEdit && task && !readOnlyArchived && !lockReady && (
          <p className="sub">Проверка доступа к задаче…</p>
        )}

        {isEdit && lockBlockedBy && (
          <div className="info-box task-lock-warn">
            Сейчас редактирует: <strong>{lockBlockedBy}</strong>. Откройте «Подробнее», чтобы добавить
            комментарии и файлы.
          </div>
        )}

        {readOnlyArchived && (
          <div className="info-box">Задача в архиве — только просмотр. Верните на доску из раздела «Архив».</div>
        )}

        {error && <div className="error">{error}</div>}

        {isView && task && commentsTask ? (
          <div className="task-editor-view-body">
            <TaskDetailView
              task={commentsTask}
              roomState={roomState}
              taskTypes={taskTypes}
              taskPriorities={taskPriorities}
            />

            <section className="task-detail-block task-detail-files">
              <h3 className="task-detail-block-title">Документы</h3>
              <p className="task-detail-files-hint">
                Можно прикрепить файлы без редактирования задачи.
              </p>
              <TaskFileGroupEditor
                kind="source"
                existing={commentsTask.source_files}
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
                existing={commentsTask.completed_files}
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
            </section>

            <TaskComments
              task={commentsTask}
              readOnly={readOnlyArchived}
              onAdded={async () => {
                const list = readOnlyArchived
                  ? await window.api.getArchivedTasks()
                  : await window.api.getTasks()
                const fresh = list.find((t) => t.id === commentsTask.id)
                if (fresh) setLiveTask(fresh)
                onSaved()
              }}
            />

            <TaskHistoryPanel taskId={task.id} />

            <div className="actions-row task-editor-view-actions">
              <button type="button" className="btn" onClick={onClose} disabled={loading}>
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
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmit(e)
            }}
          >
            <fieldset className="task-editor-fieldset" disabled={formDisabled}>
              <div className="form-group">
                <label htmlFor="taskTitle">Название</label>
                <input
                  id="taskTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название задачи"
                  autoFocus={isEdit && !fieldsReadOnly}
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
                <label htmlFor="taskPriority">Приоритет</label>
                <select
                  id="taskPriority"
                  value={priorityId}
                  onChange={(e) => setPriorityId(e.target.value)}
                >
                  {taskPriorities.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="taskDescription">Описание</label>
                <textarea
                  id="taskDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ТЗ, контекст, что нужно сделать…"
                  rows={4}
                />
              </div>

              <TaskChecklist items={checklist} disabled={formDisabled} onChange={setChecklist} />

              <div className="form-group">
                <label htmlFor="taskAssignee">Ответственный</label>
                <select
                  id="taskAssignee"
                  value={assigneePc}
                  onChange={(e) => setAssigneePc(e.target.value)}
                >
                  {pcIds.map((pcId) => (
                    <option key={pcId} value={pcId}>
                      {employees[pcId].name} — {employees[pcId].role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="taskDue">Срок выполнения</label>
                <div className="due-datetime-row">
                  <input
                    id="taskDue"
                    type="date"
                    value={dueDatePart}
                    onChange={(e) => setDueDatePart(e.target.value)}
                  />
                  <input
                    id="taskDueTime"
                    type="time"
                    value={dueTimePart}
                    onChange={(e) => setDueTimePart(e.target.value)}
                    aria-label="Время срока"
                  />
                </div>
                <p className="field-hint">Время необязательно — без него срок до конца выбранного дня.</p>
                {(dueDatePart || dueTimePart) && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setDueDatePart('')
                      setDueTimePart('')
                    }}
                  >
                    Очистить срок
                  </button>
                )}
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
                  <TaskFileGroupEditor
                    kind="source"
                    existing={commentsTask?.source_files ?? []}
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
                    existing={commentsTask?.completed_files ?? []}
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
              </details>
            </fieldset>

            {commentsTask && (
              <TaskComments
                task={commentsTask}
                readOnly={readOnlyArchived}
                onAdded={async () => {
                  const list = readOnlyArchived
                    ? await window.api.getArchivedTasks()
                    : await window.api.getTasks()
                  const fresh = list.find((t) => t.id === commentsTask.id)
                  if (fresh) setLiveTask(fresh)
                  onSaved()
                }}
              />
            )}

            {task && <TaskHistoryPanel taskId={task.id} />}

            <div className="actions-row">
              <button type="button" className="btn" onClick={onClose} disabled={loading}>
                {fieldsReadOnly && !hasPendingFiles ? 'Закрыть' : 'Отмена'}
              </button>
              {isEdit && !lockBlockedBy && (
                <button type="submit" className="btn btn-primary btn-lg" disabled={formDisabled}>
                  {loading ? 'Сохранение…' : 'Сохранить'}
                </button>
              )}
              {isCreate && (
                <button type="submit" className="btn btn-primary btn-lg" disabled={formDisabled}>
                  {loading ? 'Сохранение…' : 'Создать'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
