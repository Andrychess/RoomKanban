import { type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import type { Employee, Task, TaskFileKind, TaskType } from '../../shared/types'
import type { TaskStatus } from '../../shared/taskStatus'
import { TASK_FILE_GROUP_LABELS, taskHasFiles, formatFileCountRu } from '../../shared/taskFiles'
import { isTaskOverdue } from '../../shared/overdue'
import { UI_HINTS } from '../hints/uiHints'
import TooltipWrap from './TooltipWrap'
import { findTaskType } from '../utils/taskTypes'
import { TaskMetaRowReadonly } from './TaskMetaRow'
import TaskStatusCubes from './TaskStatusCubes'
interface Props {
  task: Task
  taskTypes: TaskType[]
  assignee?: Employee
  columnAccent?: string
  hideAssignee?: boolean
  /** Карточка всегда развёрнута, без кнопки сворачивания */
  alwaysExpanded?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onViewDetails: (task: Task) => void
  onEdit: (task: Task) => void
  onOpenFile: (taskId: string, kind: TaskFileKind, fileId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
}

const FILE_PREVIEW_LIMIT = 2

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L14.5 3.5a1.4 1.4 0 0 0-2 0L4 12v8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12.5 6.5l5 5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function DetailsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean(
    target &&
      (target as HTMLElement).closest('button, select, a, input, textarea, .task-card-no-drag')
  )
}

function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      className={`task-card-collapse-chevron ${collapsed ? 'is-collapsed' : ''}`}
      aria-hidden="true"
    />
  )
}

function TaskLabel({
  label,
  color,
  variant,
  title
}: {
  label: string
  color?: string
  variant: 'type' | 'priority' | 'due' | 'muted' | 'overdue'
  title?: string
}) {
  return (
    <span
      className={`task-label task-label--${variant}`}
      style={color ? ({ '--label-color': color } as CSSProperties) : undefined}
      title={title ?? label}
    >
      {label}
    </span>
  )
}

function TaskCardHeaderRow({
  taskType,
  typeColor,
  assignee,
  assigneeName,
  dueDate,
  overdue,
  fileBadge,
  hideAssignee = false
}: {
  taskType?: TaskType
  typeColor: string
  assignee?: Employee
  assigneeName: string
  dueDate: string | null
  overdue: boolean
  fileBadge?: ReactNode
  hideAssignee?: boolean
}) {
  return (
    <div className="task-card-labels" aria-label="Вид задачи, ответственный и срок">
      {taskType ? (
        <TaskLabel
          variant="type"
          label={taskType.name}
          color={typeColor}
          title={`Вид: ${taskType.name}`}
        />
      ) : (
        <TaskLabel variant="muted" label="Без вида" title="Вид не указан" />
      )}
      <TaskMetaRowReadonly
        assignee={assignee}
        assigneeName={assigneeName}
        dueDate={dueDate}
        overdue={overdue}
        variant="card-header"
        fileBadge={fileBadge}
        hideAssignee={hideAssignee}
      />
    </div>
  )
}

export default function TaskCard({
  task,
  taskTypes,
  assignee,
  columnAccent,
  hideAssignee = false,
  alwaysExpanded = false,
  isCollapsed = false,
  onToggleCollapse,
  onViewDetails,
  onEdit,
  onOpenFile,
  onStatusChange
}: Props) {
  const collapsed = alwaysExpanded ? false : isCollapsed
  const overdue = isTaskOverdue(task)
  const taskType = findTaskType(taskTypes, task.type_id)
  const accentColor = taskType?.color ?? columnAccent ?? '#64748b'
  const typeColor = taskType?.color ?? '#64748b'
  const hasFiles = taskHasFiles(task)
  const assigneeName = assignee?.name ?? '—'

  const fileEntries = (['source', 'completed'] as const).flatMap((kind) =>
    (kind === 'source' ? task.source_files : task.completed_files).map((file) => ({
      kind,
      file
    }))
  )
  const previewFiles = fileEntries.slice(0, FILE_PREVIEW_LIMIT)
  const hiddenFileCount = fileEntries.length - previewFiles.length
  const fileBadge = hasFiles ? (
    <span className="task-meta-badge">{formatFileCountRu(fileEntries.length)}</span>
  ) : undefined

  function handleToggleAreaClick(e: MouseEvent<HTMLElement>) {
    if (alwaysExpanded || !onToggleCollapse) return
    if (isInteractiveTarget(e.target)) return
    onToggleCollapse()
  }

  function renderCollapseToggle(className: string, isCardCollapsed: boolean) {
    if (alwaysExpanded) return null
    return (
      <TooltipWrap text={isCardCollapsed ? UI_HINTS.taskCard.expand : UI_HINTS.taskCard.collapse}>
        <button
          type="button"
          className={`task-card-collapse-toggle task-card-no-drag ${className}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse?.()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-expanded={!isCardCollapsed}
          aria-label={isCardCollapsed ? 'Развернуть карточку' : 'Свернуть карточку'}
        >
          <CollapseChevron collapsed={isCardCollapsed} />
        </button>
      </TooltipWrap>
    )
  }

  function renderFooter() {
    return (
      <div className={`task-card-footer ${collapsed ? 'task-card-footer--compact' : ''}`}>
        <TaskStatusCubes
          status={task.status}
          compact={collapsed}
          onChange={(next) => {
            if (next !== task.status) onStatusChange(task.id, next)
          }}
        />
        <div className="task-card-footer-actions">
          <TooltipWrap text={UI_HINTS.taskCard.details}>
            <button
              type="button"
              className={`task-card-icon-btn task-card-no-drag ${collapsed ? 'task-card-icon-btn--text' : ''}`}
              onClick={() => onViewDetails(task)}
            >
              {collapsed ? (
                <>
                  <DetailsIcon />
                  <span>Подробнее</span>
                </>
              ) : (
                <>
                  <DetailsIcon />
                  <span className="task-card-icon-btn-label">Подробнее</span>
                </>
              )}
            </button>
          </TooltipWrap>
          <TooltipWrap text={UI_HINTS.taskCard.edit}>
            <button
              type="button"
              className="task-card-icon-btn task-card-icon-btn--edit task-card-no-drag"
              aria-label="Редактировать задачу"
              onClick={() => onEdit(task)}
            >
              <EditIcon />
            </button>
          </TooltipWrap>
        </div>
      </div>
    )
  }

  return (
    <article
      className={`task-card ${overdue ? 'is-overdue' : ''} ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
      style={
        {
          borderLeftColor: accentColor,
          '--task-type-color': typeColor,
          '--task-priority-color': accentColor
        } as CSSProperties
      }
      draggable
      onDragStart={(e) => {
        if (isInteractiveTarget(e.target)) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('text/task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      {collapsed ? (
        <div
          className="task-card-compact"
          onClick={handleToggleAreaClick}
          role={alwaysExpanded ? undefined : 'button'}
          tabIndex={alwaysExpanded ? undefined : 0}
          aria-expanded={false}
          onKeyDown={(e) => {
            if (alwaysExpanded) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleCollapse?.()
            }
          }}
        >
          <TaskCardHeaderRow
            taskType={taskType}
            typeColor={typeColor}
            assignee={assignee}
            assigneeName={assigneeName}
            dueDate={task.due_date}
            overdue={overdue}
            fileBadge={fileBadge}
            hideAssignee={hideAssignee}
          />

          <div className="task-card-compact-main">
            <div className="task-card-title-row task-card-title-row--compact">
              {renderCollapseToggle('task-card-collapse-toggle--compact', true)}
              <TooltipWrap text={task.title}>
                <h4 className="task-card-title task-card-title--compact">{task.title}</h4>
              </TooltipWrap>
            </div>
          </div>
        </div>
      ) : (
        <div className="task-card-expanded">
          <TaskCardHeaderRow
            taskType={taskType}
            typeColor={typeColor}
            assignee={assignee}
            assigneeName={assigneeName}
            dueDate={task.due_date}
            overdue={overdue}
            fileBadge={fileBadge}
            hideAssignee={hideAssignee}
          />

          <div className="task-card-body">
            <div
              className="task-card-title-row"
              onClick={alwaysExpanded ? undefined : handleToggleAreaClick}
              role={alwaysExpanded ? undefined : 'button'}
              tabIndex={alwaysExpanded ? undefined : 0}
              aria-expanded
              onKeyDown={(e) => {
                if (alwaysExpanded) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggleCollapse?.()
                }
              }}
            >
              {renderCollapseToggle('', false)}
              <h4 className="task-card-title">{task.title}</h4>
            </div>

            <div className="task-card-details">
              {task.description ? (
                <p className="task-card-comment">{task.description}</p>
              ) : (
                <p className="task-card-comment task-card-comment--empty">Без описания</p>
              )}

              {hasFiles && (
                <ul className="task-card-file-links">
                  {previewFiles.map(({ kind, file }) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        className="task-file-link task-card-no-drag"
                        onClick={() => onOpenFile(task.id, kind, file.id)}
                      >
                        <span className="task-file-kind">{TASK_FILE_GROUP_LABELS[kind]}:</span>{' '}
                        {file.file_name}
                      </button>
                    </li>
                  ))}
                  {hiddenFileCount > 0 && (
                    <li>
                      <button
                        type="button"
                        className="task-file-link task-file-link--more task-card-no-drag"
                        onClick={() => onViewDetails(task)}
                      >
                        Ещё {hiddenFileCount}…
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {renderFooter()}
    </article>
  )
}
