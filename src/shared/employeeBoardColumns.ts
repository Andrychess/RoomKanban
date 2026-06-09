import type { Employee, Task } from './types'

export const UNASSIGNED_EMPLOYEE_COLUMN_ID = '__unassigned__'

export interface EmployeeBoardColumn {
  id: string
  title: string
  role?: string
  employee?: Employee
  isUnassigned?: boolean
}

export interface EmployeeColumnTheme {
  accent: string
  surface: string
  header: string
}

const EMPLOYEE_COLUMN_THEMES: EmployeeColumnTheme[] = [
  {
    accent: '#60a5fa',
    surface: 'rgba(96, 165, 250, 0.07)',
    header: 'rgba(96, 165, 250, 0.16)'
  },
  {
    accent: '#34d399',
    surface: 'rgba(52, 211, 153, 0.08)',
    header: 'rgba(52, 211, 153, 0.16)'
  },
  {
    accent: '#f472b6',
    surface: 'rgba(244, 114, 182, 0.08)',
    header: 'rgba(244, 114, 182, 0.16)'
  },
  {
    accent: '#fb923c',
    surface: 'rgba(251, 146, 60, 0.08)',
    header: 'rgba(251, 146, 60, 0.16)'
  },
  {
    accent: '#a78bfa',
    surface: 'rgba(167, 139, 250, 0.08)',
    header: 'rgba(167, 139, 250, 0.16)'
  },
  {
    accent: '#fbbf24',
    surface: 'rgba(251, 191, 36, 0.08)',
    header: 'rgba(251, 191, 36, 0.16)'
  },
  {
    accent: '#38bdf8',
    surface: 'rgba(56, 189, 248, 0.08)',
    header: 'rgba(56, 189, 248, 0.16)'
  },
  {
    accent: '#94a3b8',
    surface: 'rgba(148, 163, 184, 0.08)',
    header: 'rgba(148, 163, 184, 0.14)'
  }
]

export function employeeColumnTheme(index: number): EmployeeColumnTheme {
  return EMPLOYEE_COLUMN_THEMES[index % EMPLOYEE_COLUMN_THEMES.length]
}

export function buildEmployeeBoardColumns(
  employees: Record<string, Employee>,
  tasks: Task[]
): EmployeeBoardColumn[] {
  const columns: EmployeeBoardColumn[] = Object.entries(employees)
    .map(([id, employee]) => ({
      id,
      title: employee.name,
      role: employee.role,
      employee
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))

  const hasUnassigned = tasks.some((task) => !employees[task.assignee_pc])
  if (hasUnassigned) {
    columns.push({
      id: UNASSIGNED_EMPLOYEE_COLUMN_ID,
      title: 'Без ответственного',
      isUnassigned: true
    })
  }

  return columns
}

export function splitEmployeeBoardColumns(
  employees: Record<string, Employee>,
  tasks: Task[],
  currentPcId: string
): { self: EmployeeBoardColumn | null; others: EmployeeBoardColumn[] } {
  const all = buildEmployeeBoardColumns(employees, tasks)
  const self = all.find((col) => col.id === currentPcId) ?? null
  const others = all.filter((col) => col.id !== currentPcId)
  return { self, others }
}

export function countTasksForEmployee(
  tasks: Task[],
  columnId: string,
  employees: Record<string, Employee>
): number {
  return tasks.filter((task) => taskBelongsToEmployeeColumn(task, columnId, employees)).length
}

export function taskBelongsToEmployeeColumn(
  task: Task,
  columnId: string,
  employees: Record<string, Employee>
): boolean {
  if (columnId === UNASSIGNED_EMPLOYEE_COLUMN_ID) {
    return !employees[task.assignee_pc]
  }
  return task.assignee_pc === columnId
}
