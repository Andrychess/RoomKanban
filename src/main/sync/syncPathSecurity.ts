import path from 'path'

const TASK_ID_RE = /^task_[a-z0-9]+$/
const EMPLOYEE_KEY_RE = /^[a-zA-Z0-9_-]+$/

export function assertTaskId(taskId: string): void {
  if (!TASK_ID_RE.test(taskId)) {
    throw new Error('Некорректный идентификатор задачи')
  }
}

export function assertEmployeeKey(employeeKey: string): void {
  if (!EMPLOYEE_KEY_RE.test(employeeKey)) {
    throw new Error('Некорректный идентификатор сотрудника')
  }
}

/** Путь к файлу внутри папки комнаты (защита от `..` в file_rel). */
export function resolvePathInsideRoom(roomPath: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').trim()
  if (!normalized || normalized.includes('..')) {
    throw new Error('Недопустимый путь к файлу')
  }
  const roomRoot = path.resolve(roomPath)
  const full = path.resolve(roomRoot, normalized.replace(/\//g, path.sep))
  const rel = path.relative(roomRoot, full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Доступ к файлу вне папки комнаты запрещён')
  }
  return full
}
