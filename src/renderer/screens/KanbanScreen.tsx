import { useMemo, useState } from 'react'
import type { Room, Task, TaskFileKind } from '../../shared/types'
import { sortTasksInColumn } from '../../shared/columnSort'
import { COLUMN_THEMES, KANBAN_COLUMNS } from '../../shared/taskStatus'
import ColumnSortSelect from '../components/ColumnSortSelect'
import ConfirmDialog from '../components/ConfirmDialog'
import KanbanFilters from '../components/KanbanFilters'
import { useKanbanColumnSort } from '../hooks/useKanbanColumnSort'
import { useOverdueCount } from '../hooks/useOverdueCount'
import TaskCard from '../components/TaskCard'
import TaskEditor from '../components/TaskEditor'
import RoomLabelsSettings from '../components/RoomLabelsSettings'
import TaskTemplatesSettings from '../components/TaskTemplatesSettings'
import { useKanbanTaskFilters } from '../hooks/useKanbanTaskFilters'
import { useRoomTasks } from '../hooks/useRoomTasks'
import { useTaskPriorities } from '../hooks/useTaskPriorities'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  onOpenOverdue?: () => void
  overdueCount?: number
}

export default function KanbanScreen({ room, onOpenOverdue, overdueCount = 0 }: Props) {
  const { tasks, refresh } = useRoomTasks(room.path)
  const localOverdueCount = useOverdueCount(tasks)
  const overdue = overdueCount > 0 ? overdueCount : localOverdueCount
  const { types: taskTypes, refresh: refreshTypes } = useTaskTypes()
  const { priorities: taskPriorities, refresh: refreshPriorities } = useTaskPriorities()
  const { filters, setFilters, filteredTasks, hasActiveFilters, resetFilters } =
    useKanbanTaskFilters(tasks, room.pcId, room.state.employees)
  const { sorts, setColumnSort } = useKanbanColumnSort(room.path)

  const [editorOpen, setEditorOpen] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Task['status']>('review')
  const [dropTarget, setDropTarget] = useState<Task['status'] | null>(null)
  const [archiveDoneOpen, setArchiveDoneOpen] = useState(false)
  const [archivingDone, setArchivingDone] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const doneCount = useMemo(
    () => tasks.filter((t) => t.status === 'done').length,
    [tasks]
  )

  function openCreate(status: Task['status']) {
    setEditingTask(null)
    setDefaultStatus(status)
    setEditorOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setDefaultStatus(task.status)
    setEditorOpen(true)
  }

  async function changeStatus(status: Task['status'], taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    await window.api.updateTaskStatus(taskId, status)
  }

  function handleDragOverColumn(e: React.DragEvent, status: Task['status']) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(status)
  }

  async function openFile(taskId: string, kind: TaskFileKind, fileId: string) {
    try {
      await window.api.openTaskFile(taskId, kind, fileId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть файл')
    }
  }

  async function confirmArchiveDone() {
    setArchivingDone(true)
    try {
      await window.api.archiveDoneTasks()
      setArchiveDoneOpen(false)
      refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось отправить в архив')
    } finally {
      setArchivingDone(false)
    }
  }

  return (
    <>
      <div className="kanban-toolbar">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={() => openCreate('review')}
        >
          + Новая задача
        </button>
        {room.isChief && onOpenOverdue && (
          <button
            type="button"
            className={`btn btn-ghost ${overdue > 0 ? 'btn-alert' : ''}`}
            onClick={onOpenOverdue}
          >
            Просрочено{overdue > 0 ? ` (${overdue})` : ''}
          </button>
        )}
        {room.isChief && (
          <button type="button" className="btn btn-ghost" onClick={() => setTemplatesOpen(true)}>
            Шаблоны
          </button>
        )}
        {room.isChief && (
          <button type="button" className="btn btn-ghost" onClick={() => setTypesOpen(true)}>
            Настройка меток
          </button>
        )}
        <p className="kanban-hint">Перетащите карточку в другую колонку или выберите этап внизу карточки.</p>
      </div>

      <KanbanFilters
        filters={filters}
        taskTypes={taskTypes}
        taskPriorities={taskPriorities}
        hasActiveFilters={hasActiveFilters}
        onChange={setFilters}
        onReset={resetFilters}
      />

      <div className="kanban-board">
        {KANBAN_COLUMNS.map((col) => {
          const theme = COLUMN_THEMES[col.id]
          const columnTasks = sortTasksInColumn(
            filteredTasks.filter((t) => t.status === col.id),
            sorts[col.id],
            taskPriorities
          )
          const totalInColumn = tasks.filter((t) => t.status === col.id).length
          const countLabel =
            hasActiveFilters && totalInColumn !== columnTasks.length
              ? `${columnTasks.length}/${totalInColumn}`
              : String(columnTasks.length)

          return (
            <section
              key={col.id}
              className={`kanban-column kanban-column--${col.id} ${dropTarget === col.id ? 'is-drop-target' : ''}`}
              style={
                {
                  '--col-accent': theme.accent,
                  '--col-surface': theme.surface,
                  '--col-header': theme.header
                } as React.CSSProperties
              }
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDropTarget(null)
                const taskId = e.dataTransfer.getData('text/task-id')
                if (taskId) void changeStatus(col.id, taskId)
              }}
            >
              <header className="kanban-column-head">
                <div className="kanban-column-head-top">
                  <h3>{col.title}</h3>
                  <span
                    className="column-count"
                    title={
                      hasActiveFilters ? `Показано ${columnTasks.length} из ${totalInColumn}` : undefined
                    }
                  >
                    {countLabel}
                  </span>
                  <button
                    type="button"
                    className="column-add"
                    onClick={() => openCreate(col.id)}
                    title="Добавить задачу"
                    aria-label="Добавить задачу"
                  >
                    +
                  </button>
                </div>
                <ColumnSortSelect
                  value={sorts[col.id]}
                  onChange={(sortId) => void setColumnSort(col.id, sortId)}
                />
                {col.id === 'done' && doneCount > 0 && (
                  <button
                    type="button"
                    className="column-clear"
                    title="Убрать выполненные в архив"
                    onClick={() => setArchiveDoneOpen(true)}
                  >
                    В архив
                  </button>
                )}
              </header>

              <div className="kanban-column-body">
                {columnTasks.length === 0 && (
                  <p className="kanban-column-empty">
                    {hasActiveFilters && totalInColumn > 0
                      ? 'Нет задач по фильтру'
                      : 'Пока пусто'}
                  </p>
                )}
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    taskTypes={taskTypes}
                    taskPriorities={taskPriorities}
                    assignee={room.state.employees[task.assignee_pc]}
                      columnAccent={theme.accent}
                    onEdit={openEdit}
                      onOpenFile={(id, kind, fileId) => void openFile(id, kind, fileId)}
                    onStatusChange={(id, status) => void changeStatus(status, id)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {archiveDoneOpen && (
        <ConfirmDialog
          title="Отправить в архив?"
          message={`Задач в колонке «Готово»: ${doneCount}. Они исчезнут с доски, но останутся в разделе «Архив» вместе с файлами.`}
          confirmLabel="В архив"
          loading={archivingDone}
          onCancel={() => !archivingDone && setArchiveDoneOpen(false)}
          onConfirm={() => void confirmArchiveDone()}
        />
      )}

      {templatesOpen && (
        <TaskTemplatesSettings onClose={() => setTemplatesOpen(false)} />
      )}

      {editorOpen && (
        <TaskEditor
          roomState={room.state}
          currentPcId={room.pcId}
          taskTypes={taskTypes}
          taskPriorities={taskPriorities}
          task={editingTask}
          defaultStatus={defaultStatus}
          onClose={() => setEditorOpen(false)}
          onSaved={refresh}
        />
      )}

      {typesOpen && room.isChief && (
        <RoomLabelsSettings
          types={taskTypes}
          priorities={taskPriorities}
          onClose={() => setTypesOpen(false)}
          onSaved={() => {
            refreshTypes()
            refreshPriorities()
            refresh()
          }}
        />
      )}
    </>
  )
}
