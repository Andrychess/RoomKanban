import type { TaskType } from './types'

export const DEFAULT_TASK_TYPES: TaskType[] = [
  { id: 'type_general', name: 'Общая', color: '#64748b' },
  { id: 'type_urgent', name: 'Срочная', color: '#ef4444' },
  { id: 'type_docs', name: 'Документы', color: '#3b82f6' },
  { id: 'type_approval', name: 'Согласование', color: '#a855f7' }
]

export const DEFAULT_TYPE_ID = DEFAULT_TASK_TYPES[0].id
