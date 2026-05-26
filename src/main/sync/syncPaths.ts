import path from 'path'

export const SYNC_TASKS_SUBDIR = 'tasks'
export const SYNC_EXCHANGE_SUBDIR = 'exchange'
export const SYNC_HISTORY_SUBDIR = 'history'

export const LEGACY_BOARD_FILE = 'board.json'
export const LEGACY_EXCHANGE_FILE = 'exchange.json'
export const LEGACY_HISTORY_FILE = 'task_history.json'

export function syncTasksDir(roomPath: string): string {
  return path.join(roomPath, 'sync', SYNC_TASKS_SUBDIR)
}

export function syncTaskFilePath(roomPath: string, taskId: string): string {
  return path.join(syncTasksDir(roomPath), `${taskId}.json`)
}

export function syncExchangeDir(roomPath: string): string {
  return path.join(roomPath, 'sync', SYNC_EXCHANGE_SUBDIR)
}

export function syncExchangeFilePath(roomPath: string, employeeKey: string): string {
  return path.join(syncExchangeDir(roomPath), `${employeeKey}.json`)
}

export function syncHistoryDir(roomPath: string): string {
  return path.join(roomPath, 'sync', SYNC_HISTORY_SUBDIR)
}

export function syncHistoryFilePath(roomPath: string, taskId: string): string {
  return path.join(syncHistoryDir(roomPath), `${taskId}.json`)
}

export function legacyBoardPath(roomPath: string): string {
  return path.join(roomPath, 'sync', LEGACY_BOARD_FILE)
}

export function legacyExchangePath(roomPath: string): string {
  return path.join(roomPath, 'sync', LEGACY_EXCHANGE_FILE)
}

export function legacyHistoryPath(roomPath: string): string {
  return path.join(roomPath, 'sync', LEGACY_HISTORY_FILE)
}
