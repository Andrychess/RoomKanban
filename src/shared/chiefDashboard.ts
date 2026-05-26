import type { RoomState, Task } from './types'
import { filterOverdueTasks } from './overdue'
import { isActiveTask } from './tasks'

const STUCK_DAYS_SEC = 7 * 24 * 60 * 60

export interface EmployeeWorkload {
  employee_key: string
  name: string
  total: number
  in_progress: number
  overdue: number
}

export interface StuckTaskSummary {
  task: Task
  days_in_progress: number
}

export interface ChiefDashboardData {
  overdue_count: number
  without_due_count: number
  stuck_tasks: StuckTaskSummary[]
  workload: EmployeeWorkload[]
}

export function buildChiefDashboard(tasks: Task[], employees: RoomState['employees']): ChiefDashboardData {
  const active = tasks.filter(isActiveTask)
  const now = Math.floor(Date.now() / 1000)
  const overdue = filterOverdueTasks(active)

  const stuck_tasks: StuckTaskSummary[] = active
    .filter((t) => t.status === 'in_progress')
    .filter((t) => now - t.updated_at >= STUCK_DAYS_SEC)
    .map((task) => ({
      task,
      days_in_progress: Math.max(1, Math.ceil((now - task.updated_at) / (24 * 60 * 60)))
    }))
    .sort((a, b) => b.days_in_progress - a.days_in_progress)

  const without_due_count = active.filter(
    (t) => t.status !== 'done' && !t.due_date
  ).length

  const workload: EmployeeWorkload[] = Object.entries(employees).map(([key, emp]) => {
    const mine = active.filter((t) => t.assignee_pc === key)
    return {
      employee_key: key,
      name: emp.name,
      total: mine.filter((t) => t.status !== 'done').length,
      in_progress: mine.filter((t) => t.status === 'in_progress').length,
      overdue: filterOverdueTasks(mine).length
    }
  })

  workload.sort((a, b) => b.total - a.total)

  return {
    overdue_count: overdue.length,
    without_due_count,
    stuck_tasks,
    workload
  }
}
