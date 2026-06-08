import { useMemo, useState } from 'react'
import type { Room, Task, TaskFileKind } from '../../shared/types'
import {
  buildEmployeeBoardColumns,
  employeeColumnTheme,
  taskBelongsToEmployeeColumn,
  UNASSIGNED_EMPLOYEE_COLUMN_ID
} from '../../shared/employeeBoardColumns'
import KanbanFilters from '../components/KanbanFilters'
import TooltipWrap from '../components/TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'
import { useCollapsedTaskCards } from '../hooks/useCollapsedTaskCards'
import { useEmployeeKanbanColumnCollapse } from '../hooks/useEmployeeKanbanColumnCollapse'
import TaskCard from '../components/TaskCard'
import TaskEditor, { type TaskEditorMode } from '../components/TaskEditor'
import { useKanbanTaskFilters } from '../hooks/useKanbanTaskFilters'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  tasks: Task[]
  onTasksChange: () => void
  tasksLoadError?: string | null
}

export default function EmployeeKanbanScreen({
  room,
  tasks,
  onTasksChange,
  tasksLoadError = null
}: Props) {
  const { types: taskTypes } = useTaskTypes()
  const { filters, setFilters, filteredTasks, hasActiveFilters, resetFilters } =
    useKanbanTaskFilters(tasks, room.pcId, room.state.employees)
  const { collapsed, toggleColumnCollapsed, expandColumn } = useEmployeeKanbanColumnCollapse(
    room.path
  )
  const { isTaskCollapsed, toggleTaskCollapsed } = useCollapsedTaskCards(room.path)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<TaskEditorMode>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Task['status']>('review')
  const [defaultAssigneePc, setDefaultAssigneePc] = useState<string | undefined>(undefined)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const columns = useMemo(
    () => buildEmployeeBoardColumns(room.state.employees, tasks),
    [room.state.employees, tasks]
  )

  function openCreate(assigneePc: string) {
    setEditingTask(null)
    setEditorMode('create')
    setDefaultStatus('review')
    setDefaultAssigneePc(assigneePc)
    setEditorOpen(true)
  }

  function openViewDetails(task: Task) {
    setEditingTask(task)
    setEditorMode('view')
    setDefaultStatus(task.status)
    setDefaultAssigneePc(undefined)
    setEditorOpen(true)
  }

  function openEdit(task: Task) {
    setEditingTask(task)
    setEditorMode('edit')
    setDefaultStatus(task.status)
    setDefaultAssigneePc(undefined)
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

  async function changeAssignee(assigneePc: string, taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.assignee_pc === assigneePc) return
    try {
      await window.api.updateTaskAssignee(taskId, assigneePc)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось сменить ответственного')
    }
  }

  function handleDragOverColumn(e: React.DragEvent, columnId: string) {
    if (columnId === UNASSIGNED_EMPLOYEE_COLUMN_ID) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(columnId)
  }

  async function openFile(taskId: string, kind: TaskFileKind, fileId: string) {
    try {
      await window.api.openTaskFile(taskId, kind, fileId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть файл')
    }
  }

  return (
    <>
      {tasksLoadError && <div className="error banner-error">{tasksLoadError}</div>}
      <div className="kanban-layout">
        <KanbanFilters
          filters={filters}
          employees={room.state.employees}
          taskTypes={taskTypes}
          hasActiveFilters={hasActiveFilters}
          hideOwnershipFilter
          onChange={setFilters}
          onReset={resetFilters}
        />

        <div className="kanban-board-scroll kanban-board-scroll--employees">
          <div
            className="kanban-board kanban-board--employees"
            style={
              {
                '--employee-column-count': Math.max(columns.length, 1)
              } as React.CSSProperties
            }
          >
            {columns.map((col, index) => {
              const theme = employeeColumnTheme(index)
              const columnTasks = filteredTasks.filter((task) =>
                taskBelongsToEmployeeColumn(task, col.id, room.state.employees)
              )
              const totalInColumn = tasks.filter((task) =>
                taskBelongsToEmployeeColumn(task, col.id, room.state.employees)
              ).length
              const countLabel =
                hasActiveFilters && totalInColumn !== columnTasks.length
                  ? `${columnTasks.length}/${totalInColumn}`
                  : String(columnTasks.length)
              const isCollapsed = Boolean(collapsed[col.id])
              const canDrop = !col.isUnassigned

              return (
                <section
                  key={col.id}
                  className={`kanban-column kanban-column--employee ${dropTarget === col.id ? 'is-drop-target' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
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
                    if (!canDrop) return
                    const taskId = e.dataTransfer.getData('text/task-id')
                    if (taskId) {
                      expandColumn(col.id)
                      void changeAssignee(col.id, taskId)
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
                      <div className="kanban-column-employee-title">
                        <h3>{col.title}</h3>
                        {col.role ? (
                          <span className="kanban-column-employee-role">{col.role}</span>
                        ) : null}
                      </div>
                      <TooltipWrap
                        text={
                          hasActiveFilters
                            ? `${UI_HINTS.kanban.columnCount}: ${columnTasks.length} из ${totalInColumn}`
                            : `${columnTasks.length} в колонке`
                        }
                      >
                        <span className="column-count">{countLabel}</span>
                      </TooltipWrap>
                      {canDrop && (
                        <TooltipWrap text="Новая задача для этого сотрудника">
                          <button
                            type="button"
                            className="column-add"
                            onClick={() => openCreate(col.id)}
                            aria-label="Добавить задачу"
                          >
                            +
                          </button>
                        </TooltipWrap>
                      )}
                    </div>
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
                          assignee={room.state.employees[task.assignee_pc]}
                          columnAccent={theme.accent}
                          hideAssignee
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
        </div>
      </div>

      {editorOpen && (
        <TaskEditor
          roomState={room.state}
          currentPcId={room.pcId}
          taskTypes={taskTypes}
          task={editingTask}
          mode={editorMode}
          defaultStatus={defaultStatus}
          defaultAssigneePc={defaultAssigneePc}
          onClose={() => setEditorOpen(false)}
          onSaved={onTasksChange}
        />
      )}
    </>
  )
}
