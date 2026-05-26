import type { TaskPriority } from './types'

export const DEFAULT_TASK_PRIORITIES: TaskPriority[] = [
  { id: 'priority_low', name: 'Низкий', color: '#22c55e' },
  { id: 'priority_normal', name: 'Обычный', color: '#64748b' },
  { id: 'priority_high', name: 'Высокий', color: '#f97316' },
  { id: 'priority_critical', name: 'Критический', color: '#ef4444' }
]

export const DEFAULT_PRIORITY_ID = 'priority_normal'
