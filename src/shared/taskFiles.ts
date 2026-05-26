import type { TaskFile, TaskFileKind } from './types'

export const TASK_FILE_KINDS: TaskFileKind[] = ['source', 'completed']

export const TASK_FILE_GROUP_LABELS: Record<TaskFileKind, string> = {
  source: 'Исходные файлы',
  completed: 'Отработанные файлы'
}

export const TASK_FILE_GROUP_HINTS: Record<TaskFileKind, string> = {
  source: 'Письма, входящие документы, материалы по задаче',
  completed: 'Приказы, ответы, итоговые документы после выполнения'
}

export function taskFilesOfKind(task: { source_files: TaskFile[]; completed_files: TaskFile[] }, kind: TaskFileKind): TaskFile[] {
  return kind === 'source' ? task.source_files : task.completed_files
}

export function taskHasFiles(task: { source_files: TaskFile[]; completed_files: TaskFile[] }): boolean {
  return task.source_files.length > 0 || task.completed_files.length > 0
}
