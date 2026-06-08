import type { TaskStatus } from './taskStatus'

export function defaultColumnCollapsed(): Record<TaskStatus, boolean> {
  return {
    review: false,
    todo: false,
    in_progress: false,
    done: false
  }
}
