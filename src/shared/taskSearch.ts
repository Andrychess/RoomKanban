import type { Task } from './types'
import type { RoomState } from './types'

export function taskMatchesSearch(
  task: Task,
  query: string,
  employees: RoomState['employees']
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  if (task.title.toLowerCase().includes(q)) return true
  if (task.description.toLowerCase().includes(q)) return true

  const assignee = employees[task.assignee_pc]
  if (assignee?.name.toLowerCase().includes(q)) return true
  if (assignee?.role.toLowerCase().includes(q)) return true

  for (const c of task.comments) {
    if (c.text.toLowerCase().includes(q)) return true
    if (c.author_name.toLowerCase().includes(q)) return true
  }

  for (const item of task.checklist) {
    if (item.text.toLowerCase().includes(q)) return true
  }

  return false
}
