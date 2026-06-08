import { useMemo, useState } from 'react'
import type { Room, Task } from '../../shared/types'
import { STATUS_LABELS } from '../../shared/taskStatus'
import TaskEditor, { type TaskEditorMode } from '../components/TaskEditor'
import { useTaskTypes } from '../hooks/useTaskTypes'
import { findTaskType } from '../utils/taskTypes'
import { isTaskOverdue } from '../../shared/overdue'
import TooltipWrap from '../components/TooltipWrap'
import HintIcon from '../components/HintIcon'
import { UI_HINTS } from '../hints/uiHints'
import {
  buildMonthGrid,
  dueDateOnly,
  MONTH_LABELS,
  todayIso,
  WEEKDAY_LABELS
} from '../utils/dates'

interface Props {
  room: Room
  tasks: Task[]
  onTasksChange: () => void
  scope?: 'all' | 'mine'
}

export default function CalendarScreen({
  room,
  tasks,
  onTasksChange,
  scope = 'all'
}: Props) {
  const scopedTasks = useMemo(() => {
    if (scope !== 'mine') return tasks
    return tasks.filter((task) => task.assignee_pc === room.pcId)
  }, [tasks, scope, room.pcId])

  const { types: taskTypes } = useTaskTypes()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<TaskEditorMode>('create')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [createDueDate, setCreateDueDate] = useState<string | null>(null)

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of scopedTasks) {
      const day = dueDateOnly(task.due_date)
      if (!day) continue
      const list = map.get(day) ?? []
      list.push(task)
      map.set(day, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
    }
    return map
  }, [scopedTasks])

  const unscheduled = useMemo(
    () =>
      scopedTasks
        .filter((t) => !t.due_date)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [scopedTasks]
  )

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  function goToday() {
    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth())
  }

  function openViewDetails(task: Task) {
    setEditingTask(task)
    setEditorMode('view')
    setCreateDueDate(null)
    setEditorOpen(true)
  }

  function openCreate(iso: string) {
    setEditingTask(null)
    setEditorMode('create')
    setCreateDueDate(iso)
    setEditorOpen(true)
  }

  return (
    <>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="btn btn-nav" onClick={prevMonth}>
            ←
          </button>
          <h2 className="calendar-title">
            {MONTH_LABELS[month]} {year}
          </h2>
          <button type="button" className="btn btn-nav" onClick={nextMonth}>
            →
          </button>
        </div>
        <button type="button" className="btn" onClick={goToday}>
          Сегодня
        </button>
        <TooltipWrap text={UI_HINTS.calendar.addDay}>
          <button type="button" className="btn btn-primary" onClick={() => openCreate(todayIso())}>
            + Задача на сегодня
          </button>
        </TooltipWrap>
      </div>

      <div className="legends-row calendar-legend">
        <div className="task-types-legend">
          <span className="legend-section-title">Виды:</span>
          {taskTypes.map((t) => (
            <span key={t.id} className="legend-type-chip" style={{ borderColor: t.color, color: t.color }}>
              <i style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="calendar-weekday">
            {d}
          </span>
        ))}
      </div>

      <div className="calendar-grid">
        {grid.map((cell, i) => {
          const dayTasks = cell.iso ? (tasksByDate.get(cell.iso) ?? []) : []
          return (
            <div
              key={`${cell.iso}-${i}`}
              className={`calendar-cell ${cell.isCurrentMonth ? '' : 'calendar-cell-out'} ${cell.isToday ? 'calendar-cell-today' : ''}`}
            >
              <div className="calendar-cell-head">
                <span className="calendar-day-num">{cell.day}</span>
                {cell.isCurrentMonth && cell.iso && (
                  <TooltipWrap text={UI_HINTS.calendar.addDay}>
                    <button
                      type="button"
                      className="btn-link calendar-add"
                      onClick={() => openCreate(cell.iso!)}
                      aria-label="Добавить задачу"
                    >
                      +
                    </button>
                  </TooltipWrap>
                )}
              </div>
              <ul className="calendar-task-list">
                {dayTasks.map((task) => {
                  const overdue = isTaskOverdue(task)
                  const assignee = room.state.employees[task.assignee_pc]
                  const type = findTaskType(taskTypes, task.type_id)
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        className={`calendar-task ${overdue ? 'calendar-task-overdue' : ''} cal-status-${task.status}`}
                        style={type ? { borderLeftColor: type.color } : undefined}
                        onClick={() => openViewDetails(task)}
                      >
                        <span className="calendar-task-tags">
                          {type && (
                            <span className="calendar-task-type" style={{ color: type.color }}>
                              {type.name}
                            </span>
                          )}
                        </span>
                        <span className="calendar-task-title">{task.title}</span>
                        <span className="calendar-task-meta">
                          {scope === 'all' && (
                            <>
                              {assignee?.name} ·{' '}
                            </>
                          )}
                          {room.state.employees[task.created_by_pc]?.name ?? '—'} ·{' '}
                          {STATUS_LABELS[task.status]}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {unscheduled.length > 0 && (
        <section className="calendar-unscheduled card">
          <h3>
            Без срока ({unscheduled.length})
            <HintIcon topic="calendar.noDue" />
          </h3>
          <ul className="unscheduled-list">
            {unscheduled.map((task) => {
              const type = findTaskType(taskTypes, task.type_id)
              return (
                <li key={task.id}>
                  <button type="button" className="unscheduled-item" onClick={() => openViewDetails(task)}>
                    <span className="unscheduled-tags">
                      {type && (
                        <span className="task-type-badge small" style={{ background: type.color }}>
                          {type.name}
                        </span>
                      )}
                    </span>
                    <strong>{task.title}</strong>
                    <span>
                      {scope === 'all' && (
                        <>
                          {room.state.employees[task.assignee_pc]?.name ?? '—'} ·{' '}
                        </>
                      )}
                      создал {room.state.employees[task.created_by_pc]?.name ?? '—'} ·{' '}
                      {STATUS_LABELS[task.status]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="calendar-legend card">
        {Object.entries(STATUS_LABELS).map(([id, label]) => (
          <span key={id}>
            <i className={`legend-dot cal-legend-${id}`} /> {label}
          </span>
        ))}
        <span className="legend-overdue">
          Просроченные выделены красным
          <HintIcon topic="calendar.overdueLegend" />
        </span>
      </section>

      {editorOpen && (
        <TaskEditor
          roomState={room.state}
          currentPcId={room.pcId}
          taskTypes={taskTypes}
          task={editingTask}
          mode={editorMode}
          defaultStatus="review"
          defaultDueDate={createDueDate}
          defaultAssigneePc={scope === 'mine' ? room.pcId : undefined}
          onClose={() => setEditorOpen(false)}
          onSaved={onTasksChange}
        />
      )}
    </>
  )
}
