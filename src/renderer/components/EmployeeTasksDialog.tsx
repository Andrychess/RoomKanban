import { useMemo, useState } from 'react'
import type { RoomState, Task, TaskFileKind, TaskType } from '../../shared/types'
import { sortTasksByStatus, sortTasksByType } from '../../shared/columnSort'
import { STATUS_LABELS, TASK_STATUSES } from '../../shared/taskStatus'
import { taskBelongsToEmployeeColumn } from '../../shared/employeeBoardColumns'
import ColumnScrollFrame from './ColumnScrollFrame'
import TaskCard from './TaskCard'
import { useCollapsedTaskCards } from '../hooks/useCollapsedTaskCards'

export type EmployeeTasksStatusFilter = 'all' | 'all_except_done' | Task['status']
export type EmployeeTasksSort = 'type' | 'status'

interface Props {
  roomPath: string
  roomState: RoomState
  currentPcId: string
  employeeId: string
  employeeName: string
  employeeRole?: string
  tasks: Task[]
  taskTypes: TaskType[]
  onClose: () => void
  onViewDetails: (task: Task) => void
  onEdit: (task: Task) => void
  onOpenFile: (taskId: string, kind: TaskFileKind, fileId: string) => void
  onStatusChange: (taskId: string, status: Task['status']) => void
}

function matchesStatusFilter(task: Task, filter: EmployeeTasksStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'all_except_done') return task.status !== 'done'
  return task.status === filter
}

export default function EmployeeTasksDialog({
  roomPath,
  roomState,
  currentPcId,
  employeeId,
  employeeName,
  employeeRole,
  tasks,
  taskTypes,
  onClose,
  onViewDetails,
  onEdit,
  onOpenFile,
  onStatusChange
}: Props) {
  const [statusFilter, setStatusFilter] = useState<EmployeeTasksStatusFilter>('all_except_done')
  const [sortBy, setSortBy] = useState<EmployeeTasksSort>('type')
  const { isTaskCollapsed, toggleTaskCollapsed } = useCollapsedTaskCards(roomPath)

  const employeeTasks = useMemo(
    () =>
      tasks.filter((task) => taskBelongsToEmployeeColumn(task, employeeId, roomState.employees)),
    [tasks, employeeId, roomState.employees]
  )

  const displayedTasks = useMemo(() => {
    const filtered = employeeTasks.filter((task) => matchesStatusFilter(task, statusFilter))
    return sortBy === 'type' ? sortTasksByType(filtered, taskTypes) : sortTasksByStatus(filtered)
  }, [employeeTasks, statusFilter, sortBy, taskTypes])

  return (
    <div className="modal-overlay employee-tasks-overlay" onClick={onClose}>
      <div
        className="modal card employee-tasks-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="employee-tasks-title"
      >
        <header className="employee-tasks-dialog-head">
          <div>
            <h2 id="employee-tasks-title">{employeeName}</h2>
            {employeeRole ? <p className="employee-tasks-dialog-role">{employeeRole}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="employee-tasks-toolbar">
          <label className="employee-tasks-filter">
            <span className="employee-tasks-filter-label">Этап</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EmployeeTasksStatusFilter)}
            >
              <option value="all">Все</option>
              <option value="all_except_done">Все кроме готовых</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="employee-tasks-filter">
            <span className="employee-tasks-filter-label">Сортировка</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as EmployeeTasksSort)}>
              <option value="type">По виду задачи</option>
              <option value="status">По этапу</option>
            </select>
          </label>
          <span className="employee-tasks-count">
            {displayedTasks.length} из {employeeTasks.length}
          </span>
        </div>

        <ColumnScrollFrame bodyClassName="employee-tasks-list">
          {displayedTasks.length === 0 ? (
            <p className="employee-tasks-empty">Нет задач по выбранному фильтру</p>
          ) : (
            displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                taskTypes={taskTypes}
                assignee={roomState.employees[task.assignee_pc]}
                hideAssignee={employeeId === currentPcId}
                isCollapsed={isTaskCollapsed(task.id)}
                onToggleCollapse={() => toggleTaskCollapsed(task.id)}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onOpenFile={onOpenFile}
                onStatusChange={onStatusChange}
              />
            ))
          )}
        </ColumnScrollFrame>
      </div>
    </div>
  )
}
