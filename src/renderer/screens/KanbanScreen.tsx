import { useMemo, useState } from 'react'
import type { Room, Task, TaskFileKind } from '../../shared/types'
import { sortTasksInColumn } from '../../shared/columnSort'
import { COLUMN_THEMES, KANBAN_COLUMNS } from '../../shared/taskStatus'
import ColumnSortSelect from '../components/ColumnSortSelect'
import ConfirmDialog from '../components/ConfirmDialog'
import KanbanFilters from '../components/KanbanFilters'
import TooltipWrap from '../components/TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'
import { useCollapsedTaskCards } from '../hooks/useCollapsedTaskCards'
import { useKanbanColumnCollapse } from '../hooks/useKanbanColumnCollapse'
import { useKanbanColumnSort } from '../hooks/useKanbanColumnSort'
import { useOverdueCount } from '../hooks/useOverdueCount'
import TaskCard from '../components/TaskCard'
import TaskEditor, { type TaskEditorMode } from '../components/TaskEditor'
import RoomLabelsSettings from '../components/RoomLabelsSettings'
import TaskTemplatesSettings from '../components/TaskTemplatesSettings'
import { useKanbanTaskFilters } from '../hooks/useKanbanTaskFilters'
import { useTaskPriorities } from '../hooks/useTaskPriorities'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  tasks: Task[]
  onTasksChange: () => void
  onOpenOverdue?: () => void
  overdueCount?: number
  tasksLoadError?: string | null
}

export default function KanbanScreen({
  room,
  tasks,
  onTasksChange,
  onOpenOverdue,
  overdueCount = 0,
  tasksLoadError = null
}: Props) {
  const localOverdueCount = useOverdueCount(tasks)
  const overdue = overdueCount > 0 ? overdueCount : localOverdueCount
  const { types: taskTypes, refresh: refreshTypes } = useTaskTypes()
  const { priorities: taskPriorities, refresh: refreshPriorities } = useTaskPriorities()
  const { filters, setFilters, filteredTasks, hasActiveFilters, resetFilters } =
    useKanbanTaskFilters(tasks, room.pcId, room.state.employees)
  const { sorts, setColumnSort } = useKanbanColumnSort(room.path)
  const { collapsed, toggleColumnCollapsed, expandColumn } = useKanbanColumnCollapse(room.path)
  const { isTaskCollapsed, toggleTaskCollapsed } = useCollapsedTaskCards(room.path)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<TaskEditorMode>('create')
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
    setEditorMode('create')
    setDefaultStatus(status)
    setEditorOpen(true)
  }

  function openViewDetails(task: Task) {
    setEditingTask(task)
    setEditorMode('view')
    setDefaultStatus(task.status)
    setEditorOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setEditorMode('edit')
    setDefaultStatus(task.status)
    setEditorOpen(true)
  }

  async function changeStatus(status: Task['status'], taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === status) return
    try {
      await window.api.updateTaskStatus(taskId, status)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось сменить этап')
    }
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
      onTasksChange()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось отправить в архив')
    } finally {
      setArchivingDone(false)
    }
  }

  return (
    <>
      {tasksLoadError && <div className="error banner-error">{tasksLoadError}</div>}
      <div className="kanban-toolbar">
        <TooltipWrap text={UI_HINTS.kanban.newTask}>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => openCreate('review')}
          >
            + Новая задача
          </button>
        </TooltipWrap>
        {room.isChief && onOpenOverdue && (
          <TooltipWrap text={UI_HINTS.kanban.overdue}>
            <button
              type="button"
              className={`btn btn-ghost ${overdue > 0 ? 'btn-alert' : ''}`}
              onClick={onOpenOverdue}
            >
              Просрочено{overdue > 0 ? ` (${overdue})` : ''}
            </button>
          </TooltipWrap>
        )}
        {room.isChief && (
          <TooltipWrap text={UI_HINTS.kanban.templates}>
            <button type="button" className="btn btn-ghost" onClick={() => setTemplatesOpen(true)}>
              Шаблоны
            </button>
          </TooltipWrap>
        )}
        {room.isChief && (
          <TooltipWrap text={UI_HINTS.kanban.labels}>
            <button type="button" className="btn btn-ghost" onClick={() => setTypesOpen(true)}>
              Настройка меток
            </button>
          </TooltipWrap>
        )}
        <p className="kanban-hint">{UI_HINTS.kanban.dragHint}</p>
      </div>

      <KanbanFilters
        filters={filters}
        employees={room.state.employees}
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

          const isCollapsed = collapsed[col.id]

          return (
            <section
              key={col.id}
              className={`kanban-column kanban-column--${col.id} ${dropTarget === col.id ? 'is-drop-target' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
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
                if (taskId) {
                  expandColumn(col.id)
                  void changeStatus(col.id, taskId)
                }
              }}
            >
              <header className="kanban-column-head">
                <div className="kanban-column-head-top">
                  <TooltipWrap
                    text={
                      isCollapsed
                        ? UI_HINTS.kanban.columnExpand
                        : UI_HINTS.kanban.columnCollapse
                    }
                  >
                    <button
                      type="button"
                      className="column-collapse-toggle"
                      onClick={() => toggleColumnCollapsed(col.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={isCollapsed ? 'Развернуть колонку' : 'Свернуть колонку'}
                    >
                      <span className="column-collapse-chevron" aria-hidden="true" />
                    </button>
                  </TooltipWrap>
                  <h3>{col.title}</h3>
                  <TooltipWrap
                    text={
                      hasActiveFilters
                        ? `${UI_HINTS.kanban.columnCount}: ${columnTasks.length} из ${totalInColumn}`
                        : `${columnTasks.length} в колонке`
                    }
                  >
                    <span className="column-count">{countLabel}</span>
                  </TooltipWrap>
                  <TooltipWrap text={UI_HINTS.kanban.columnAdd}>
                    <button
                      type="button"
                      className="column-add"
                      onClick={() => openCreate(col.id)}
                      aria-label="Добавить задачу"
                    >
                      +
                    </button>
                  </TooltipWrap>
                </div>
                {!isCollapsed && (
                  <>
                    <ColumnSortSelect
                      value={sorts[col.id]}
                      onChange={(sortId) => void setColumnSort(col.id, sortId)}
                    />
                    {col.id === 'done' && doneCount > 0 && (
                      <TooltipWrap text={UI_HINTS.kanban.columnArchive}>
                        <button
                          type="button"
                          className="column-clear"
                          onClick={() => setArchiveDoneOpen(true)}
                        >
                          В архив
                        </button>
                      </TooltipWrap>
                    )}
                  </>
                )}
              </header>

              {!isCollapsed && (
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
                    isCollapsed={isTaskCollapsed(task.id)}
                    onToggleCollapse={() => toggleTaskCollapsed(task.id)}
                    onViewDetails={openViewDetails}
                    onEdit={openEdit}
                    onOpenFile={(id, kind, fileId) => void openFile(id, kind, fileId)}
                    onStatusChange={(id, status) => void changeStatus(status, id)}
                  />
                ))}
              </div>
              )}
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
          mode={editorMode}
          defaultStatus={defaultStatus}
          onClose={() => setEditorOpen(false)}
          onSaved={onTasksChange}
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
            onTasksChange()
          }}
        />
      )}
    </>
  )
}
