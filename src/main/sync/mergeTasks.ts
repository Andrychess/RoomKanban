import type { Task } from '../../shared/types'

/** При конфликте версий побеждает задача с большим updated_at. */
export function mergeTasksByUpdatedAt(preferred: Task[], base: Task[]): Task[] {
  const map = new Map<string, Task>()
  for (const task of base) {
    map.set(task.id, task)
  }
  for (const task of preferred) {
    const existing = map.get(task.id)
    if (!existing || task.updated_at >= existing.updated_at) {
      map.set(task.id, task)
    }
  }
  return Array.from(map.values())
}
