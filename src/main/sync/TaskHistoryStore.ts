import fs from 'fs/promises'
import path from 'path'
import type { TaskHistoryEntry } from '../../shared/types'
import { toHistoryEntry, type HistoryDraft } from '../../shared/taskHistory'
import { AsyncMutex } from './AsyncMutex'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'
import {
  legacyHistoryPath,
  syncHistoryDir,
  syncHistoryFilePath
} from './syncPaths'
import { assertTaskId } from './syncPathSecurity'

interface TaskHistoryData {
  entries: TaskHistoryEntry[]
  updated_at: number
}

const MAX_ENTRIES_PER_TASK = 500

export class TaskHistoryStore {
  private historyDir: string
  private mutex = new AsyncMutex()

  constructor(private roomPath: string) {
    this.historyDir = syncHistoryDir(roomPath)
  }

  async ensureDefaults(): Promise<void> {
    await fs.mkdir(path.join(this.roomPath, 'sync'), { recursive: true })
    await fs.mkdir(this.historyDir, { recursive: true })
    if (!(await this.hasPerTaskHistory())) {
      await this.migrateFromLegacyFile()
    }
  }

  private async hasPerTaskHistory(): Promise<boolean> {
    try {
      const entries = await fs.readdir(this.historyDir)
      return entries.some((n) => n.endsWith('.json'))
    } catch {
      return false
    }
  }

  private async migrateFromLegacyFile(): Promise<void> {
    const legacyPath = legacyHistoryPath(this.roomPath)
    const { data, ok } = await readJsonFile<TaskHistoryData>(legacyPath, {
      entries: [],
      updated_at: 0
    })
    if (!ok || data.entries.length === 0) return

    const byTask = new Map<string, TaskHistoryEntry[]>()
    for (const entry of data.entries) {
      const list = byTask.get(entry.task_id) ?? []
      list.push(entry)
      byTask.set(entry.task_id, list)
    }

    for (const [taskId, entries] of byTask) {
      await this.writeTaskFile(taskId, entries)
    }

    const migratedPath = `${legacyPath}.migrated`
    try {
      await fs.rename(legacyPath, migratedPath)
    } catch {
      /* already moved or missing */
    }
  }

  private async readTaskFile(taskId: string): Promise<TaskHistoryData> {
    const { data, ok } = await readJsonFile<TaskHistoryData>(
      syncHistoryFilePath(this.roomPath, taskId),
      { entries: [], updated_at: 0 }
    )
    if (!ok) return { entries: [], updated_at: 0 }
    return { entries: data.entries ?? [], updated_at: data.updated_at ?? 0 }
  }

  private async writeTaskFile(taskId: string, entries: TaskHistoryEntry[]): Promise<void> {
    const trimmed =
      entries.length > MAX_ENTRIES_PER_TASK
        ? entries.slice(-MAX_ENTRIES_PER_TASK)
        : entries
    const payload: TaskHistoryData = {
      entries: trimmed,
      updated_at: Math.floor(Date.now() / 1000)
    }
    if (trimmed.length === 0) {
      try {
        await fs.unlink(syncHistoryFilePath(this.roomPath, taskId))
      } catch {
        /* no file */
      }
      return
    }
    await writeJsonFileAtomic(syncHistoryFilePath(this.roomPath, taskId), payload)
  }

  async appendMany(taskId: string, drafts: HistoryDraft[]): Promise<void> {
    if (drafts.length === 0) return
    assertTaskId(taskId)
    await this.mutex.run(async () => {
      const file = await this.readTaskFile(taskId)
      for (const draft of drafts) {
        file.entries.push(toHistoryEntry(taskId, draft))
      }
      await this.writeTaskFile(taskId, file.entries)
    })
  }

  async getForTask(taskId: string, limit = 100): Promise<TaskHistoryEntry[]> {
    const file = await this.readTaskFile(taskId)
    return file.entries.sort((a, b) => b.at - a.at).slice(0, limit)
  }

  async deleteForTask(taskId: string): Promise<void> {
    assertTaskId(taskId)
    await this.mutex.run(async () => {
      try {
        await fs.unlink(syncHistoryFilePath(this.roomPath, taskId))
      } catch {
        /* no file */
      }
    })
  }
}
