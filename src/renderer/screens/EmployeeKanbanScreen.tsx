import { useMemo, useRef, useState, type DragEvent } from 'react'
import type { Room, Task, TaskFileKind } from '../../shared/types'
import {
  employeeColumnTheme,
  splitEmployeeBoardColumns,
  taskBelongsToEmployeeColumn,
  type EmployeeBoardColumn
} from '../../shared/employeeBoardColumns'
import ColumnScrollFrame from '../components/ColumnScrollFrame'
import EmployeePanelCard from '../components/EmployeePanelCard'
import EmployeeTasksDialog from '../components/EmployeeTasksDialog'
import TooltipWrap from '../components/TooltipWrap'
import { UI_HINTS } from '../hints/uiHints'
import { useBoardColumnCollapse } from '../hooks/useBoardColumnCollapse'
import { useCollapsedTaskCards } from '../hooks/useCollapsedTaskCards'
import { useKanbanBoardMetrics } from '../hooks/useKanbanBoardMetrics'
import TaskCard from '../components/TaskCard'
import TaskEditor, { type TaskEditorMode } from '../components/TaskEditor'
import { useTaskTypes } from '../hooks/useTaskTypes'

interface Props {
  room: Room
  tasks: Task[]
  onTasksChange: () => void
  tasksLoadError?: string | null
}

const SELF_COLUMN_COLLAPSE_KEY = 'roomKanban:employeeSelfColumnCollapsed'

export default function EmployeeKanbanScreen({
  room,
  tasks,
  onTasksChange,
  tasksLoadError = null
}: Props) {
  const { types: taskTypes } = useTaskTypes()
  const { collapsed, toggleColumnCollapsed } = useBoardColumnCollapse(
    room.path,
    SELF_COLUMN_COLLAPSE_KEY
  )
  const { isTaskCollapsed, toggleTaskCollapsed } = useCollapsedTaskCards(room.path)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<TaskEditorMode>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Task['status']>('review')
  const [defaultAssigneePc, setDefaultAssigneePc] = useState<string | undefined>(undefined)
  const [dialogEmployee, setDialogEmployee] = useState<EmployeeBoardColumn | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const { self, others } = useMemo(
    () => splitEmployeeBoardColumns(room.state.employees, tasks, room.pcId),
    [room.state.employees, tasks, room.pcId]
  )
  const screenRef = useRef<HTMLDivElement>(null)
  const { style: boardStyle } = useKanbanBoardMetrics(screenRef, {
    columnCount: 1,
    matrixItemCount: others.length
  })

  const selfTheme = employeeColumnTheme(0)
  const selfCollapsed = self ? Boolean(collapsed[self.id]) : false
  const selfTasks = useMemo(
    () =>
      self
        ? tasks.filter((task) => taskBelongsToEmployeeColumn(task, self.id, room.state.employees))
        : [],
    [tasks, self, room.state.employees]
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

  async function openFile(taskId: string, kind: TaskFileKind, fileId: string) {
    try {
      await window.api.openTaskFile(taskId, kind, fileId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось открыть файл')
    }
  }

  function handleDragOverEmployee(e: DragEvent, employeeId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetId(employeeId)
  }

  async function assignTaskToEmployee(taskId: string, assigneePc: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.assignee_pc !== room.pcId || assigneePc === room.pcId) return

    try {
      await window.api.updateTaskAssignee(taskId, assigneePc)
      if (task.status === 'review') {
        await window.api.updateTaskStatus(taskId, 'todo')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось назначить задачу')
    }
  }

  return (
    <div
      ref={screenRef}
      className={`kanban-screen employee-board-screen${boardStyle ? ' kanban-screen--sized' : ''}`}
      style={boardStyle}
    >
      {tasksLoadError && <div className="error banner-error">{tasksLoadError}</div>}
      <div className="kanban-layout employee-board-layout" data-board-anchor>
        {self && (
          <aside className="employee-board-self">
            <section
              className={`kanban-column kanban-column--employee kanban-column--self ${selfCollapsed ? 'is-collapsed' : ''}`}
              style={
                {
                  '--col-accent': selfTheme.accent,
                  '--col-surface': selfTheme.surface,
                  '--col-header': selfTheme.header
                } as React.CSSProperties
              }
            >
              <header className="kanban-column-head">
                <div className="kanban-column-head-top">
                  <TooltipWrap
                    text={
                      selfCollapsed ? UI_HINTS.kanban.columnExpand : UI_HINTS.kanban.columnCollapse
                    }
                  >
                    <button
                      type="button"
                      className="column-collapse-toggle"
                      onClick={() => toggleColumnCollapsed(self.id)}
                      aria-expanded={!selfCollapsed}
                      aria-label={selfCollapsed ? 'Развернуть колонку' : 'Свернуть колонку'}
                    >
                      <span className="column-collapse-chevron" aria-hidden="true" />
                    </button>
                  </TooltipWrap>
                  <div className="kanban-column-employee-title">
                    <span className="employee-self-badge">Вы</span>
                    <h3>{self.title}</h3>
                    {self.role ? (
                      <span className="kanban-column-employee-role">{self.role}</span>
                    ) : null}
                  </div>
                  <span className="column-count">{selfTasks.length}</span>
                  <TooltipWrap text="Новая задача для вас">
                    <button
                      type="button"
                      className="column-add"
                      onClick={() => openCreate(self.id)}
                      aria-label="Добавить задачу"
                    >
                      +
                    </button>
                  </TooltipWrap>
                </div>
              </header>

              {!selfCollapsed && (
                <ColumnScrollFrame bodyClassName="kanban-column-body">
                  {selfTasks.length === 0 && (
                    <p className="kanban-column-empty">Пока пусто</p>
                  )}
                  {selfTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      taskTypes={taskTypes}
                      assignee={room.state.employees[task.assignee_pc]}
                      columnAccent={selfTheme.accent}
                      hideAssignee
                      isCollapsed={isTaskCollapsed(task.id)}
                      onToggleCollapse={() => toggleTaskCollapsed(task.id)}
                      onViewDetails={openViewDetails}
                      onEdit={openEdit}
                      onOpenFile={(id, kind, fileId) => void openFile(id, kind, fileId)}
                      onStatusChange={(id, status) => void changeStatus(status, id)}
                    />
                  ))}
                </ColumnScrollFrame>
              )}
            </section>
          </aside>
        )}

        <div className="employee-board-others-scroll">
          <div className="employee-board-matrix">
            {others.map((col, index) => {
              const theme = employeeColumnTheme(index + 1)
              return (
                <EmployeePanelCard
                  key={col.id}
                  column={col}
                  tasks={tasks}
                  employees={room.state.employees}
                  accent={theme.accent}
                  surface={theme.surface}
                  header={theme.header}
                  isDropTarget={dropTargetId === col.id}
                  onDragOver={(e) => handleDragOverEmployee(e, col.id)}
                  onDragLeave={() => setDropTargetId(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDropTargetId(null)
                    const taskId = e.dataTransfer.getData('text/task-id')
                    if (taskId) void assignTaskToEmployee(taskId, col.id)
                  }}
                  onOpenAll={() => setDialogEmployee(col)}
                />
              )
            })}
            {others.length === 0 && (
              <p className="employee-board-others-empty">Других сотрудников в комнате нет</p>
            )}
          </div>
        </div>
      </div>

      {dialogEmployee && (
        <EmployeeTasksDialog
          roomPath={room.path}
          roomState={room.state}
          currentPcId={room.pcId}
          employeeId={dialogEmployee.id}
          employeeName={dialogEmployee.title}
          employeeRole={dialogEmployee.role}
          tasks={tasks}
          taskTypes={taskTypes}
          onClose={() => setDialogEmployee(null)}
          onViewDetails={openViewDetails}
          onEdit={openEdit}
          onOpenFile={(id, kind, fileId) => void openFile(id, kind, fileId)}
          onStatusChange={(id, status) => void changeStatus(status, id)}
        />
      )}

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
    </div>
  )
}
