import fs from 'fs/promises'
import path from 'path'
import type { BoardData } from '../../shared/types'
import { legacyBoardPath, syncTasksDir } from './syncPaths'

/** Подсчёт активных задач для списка комнат (поддержка legacy board.json). */
export async function getRoomTaskStats(
  roomPath: string
): Promise<{ task_count: number; last_sync_at: number | null }> {
  const tasksDir = syncTasksDir(roomPath)
  let task_count = 0
  let last_sync_at = 0

  try {
    const entries = await fs.readdir(tasksDir)
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(tasksDir, name), 'utf-8')
        const t = JSON.parse(raw) as { archived_at?: number | null; updated_at?: number }
        if (!t.archived_at) task_count++
        if (typeof t.updated_at === 'number') {
          last_sync_at = Math.max(last_sync_at, t.updated_at)
        }
      } catch {
        /* skip broken file */
      }
    }
    if (entries.some((n) => n.endsWith('.json'))) {
      return { task_count, last_sync_at: last_sync_at > 0 ? last_sync_at : null }
    }
  } catch {
    /* no tasks dir */
  }

  try {
    const boardRaw = await fs.readFile(legacyBoardPath(roomPath), 'utf-8')
    const board = JSON.parse(boardRaw) as BoardData
    task_count =
      board.tasks?.filter((t) => {
        const raw = t as { archived_at?: number | null }
        return !raw.archived_at
      }).length ?? 0
    return { task_count, last_sync_at: board.updated_at ?? null }
  } catch {
    return { task_count: 0, last_sync_at: null }
  }
}
