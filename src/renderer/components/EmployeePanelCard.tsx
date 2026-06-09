import type { CSSProperties, DragEvent } from 'react'
import {
  taskBelongsToEmployeeColumn,
  type EmployeeBoardColumn
} from '../../shared/employeeBoardColumns'
import type { Employee, Task } from '../../shared/types'
import TooltipWrap from './TooltipWrap'

interface Props {
  column: EmployeeBoardColumn
  tasks: Task[]
  employees: Record<string, Employee>
  accent: string
  surface: string
  header: string
  isDropTarget: boolean
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onOpenAll: () => void
}

export default function EmployeePanelCard({
  column,
  tasks,
  employees,
  accent,
  surface,
  header,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenAll
}: Props) {
  const employeeTasks = tasks.filter((task) =>
    taskBelongsToEmployeeColumn(task, column.id, employees)
  )
  const activeCount = employeeTasks.filter((t) => t.status !== 'done').length

  return (
    <article
      className={`employee-panel-column ${isDropTarget ? 'is-drop-target' : ''}`}
      style={
        {
          '--panel-accent': accent,
          '--panel-surface': surface,
          '--panel-header': header
        } as CSSProperties
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="employee-panel-column-head">
        <div className="employee-panel-column-head-top">
          <div className="employee-panel-column-title">
            <h3 className="employee-panel-column-name">{column.title}</h3>
            {column.role ? (
              <span className="employee-panel-column-role">{column.role}</span>
            ) : null}
          </div>
          <span className="column-count employee-panel-column-count">{employeeTasks.length}</span>
        </div>
        <div className="employee-panel-column-meta">
          <span className="employee-panel-column-stat">
            {activeCount} активных · {employeeTasks.length} всего
          </span>
        </div>
      </header>

      <div className="employee-panel-drop-zone" aria-hidden="true">
        <p className="employee-panel-drop-zone-text">
          Перетащите сюда задачу из вашей колонки
        </p>
      </div>

      <footer className="employee-panel-column-foot">
        <TooltipWrap text="Полный список с фильтрами и сортировкой">
          <button type="button" className="btn btn-ghost btn-sm employee-panel-open-all" onClick={onOpenAll}>
            Все задачи
          </button>
        </TooltipWrap>
      </footer>
    </article>
  )
}
