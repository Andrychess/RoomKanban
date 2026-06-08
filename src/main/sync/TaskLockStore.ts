import fs from 'fs/promises'
import path from 'path'
import type { TaskLockHolder, TaskLockResult } from '../../shared/types'
import { AsyncMutex } from './AsyncMutex'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'

const LOCK_TTL_SEC = 180

interface TaskLocksFile {
  locks: Record<string, TaskLockHolder>
  updated_at: number
}

export class TaskLockStore {
  private locksPath: string
  private mutex = new AsyncMutex()

  constructor(private roomPath: string) {
    this.locksPath = path.join(roomPath, 'sync', 'task_locks.json')
  }

  start(): void {
    /* Блокировки читаются при каждом IPC-запросе; отдельный watcher не нужен. */
  }

  stop(): void {
    /* noop */
  }

  private async readLocks(): Promise<TaskLocksFile> {
    const { data } = await readJsonFile<TaskLocksFile>(this.locksPath, {
      locks: {},
      updated_at: 0
    })
    return { locks: data.locks ?? {}, updated_at: data.updated_at ?? 0 }
  }

  private async writeLocks(locks: Record<string, TaskLockHolder>): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const cleaned: Record<string, TaskLockHolder> = {}
    for (const [taskId, lock] of Object.entries(locks)) {
      if (now - lock.since <= LOCK_TTL_SEC) {
        cleaned[taskId] = lock
      }
    }
    const data: TaskLocksFile = { locks: cleaned, updated_at: now }
    await writeJsonFileAtomic(this.locksPath, data)
  }

  private isStale(lock: TaskLockHolder, now: number): boolean {
    return now - lock.since > LOCK_TTL_SEC
  }

  async acquire(
    taskId: string,
    employeeKey: string,
    employeeName: string
  ): Promise<TaskLockResult> {
    return this.mutex.run(async () => {
      const now = Math.floor(Date.now() / 1000)
      const file = await this.readLocks()
      const existing = file.locks[taskId]

      if (existing && !this.isStale(existing, now) && existing.employee_key !== employeeKey) {
        return { acquired: false, holder: existing }
      }

      file.locks[taskId] = {
        employee_key: employeeKey,
        employee_name: employeeName,
        since: now
      }
      await this.writeLocks(file.locks)
      return { acquired: true, holder: null }
    })
  }

  async release(taskId: string, employeeKey: string): Promise<void> {
    await this.mutex.run(async () => {
      const file = await this.readLocks()
      const existing = file.locks[taskId]
      if (existing?.employee_key === employeeKey) {
        delete file.locks[taskId]
        await this.writeLocks(file.locks)
      }
    })
  }

  async clearLock(taskId: string): Promise<void> {
    await this.mutex.run(async () => {
      const file = await this.readLocks()
      if (!file.locks[taskId]) return
      delete file.locks[taskId]
      await this.writeLocks(file.locks)
    })
  }

  async refresh(taskId: string, employeeKey: string): Promise<boolean> {
    return this.mutex.run(async () => {
      const now = Math.floor(Date.now() / 1000)
      const file = await this.readLocks()
      const existing = file.locks[taskId]
      if (!existing || existing.employee_key !== employeeKey) return false
      if (this.isStale(existing, now)) return false
      existing.since = now
      await this.writeLocks(file.locks)
      return true
    })
  }

  async releaseAllForEmployee(employeeKey: string): Promise<void> {
    await this.mutex.run(async () => {
      const file = await this.readLocks()
      let changed = false
      for (const [taskId, lock] of Object.entries(file.locks)) {
        if (lock.employee_key === employeeKey) {
          delete file.locks[taskId]
          changed = true
        }
      }
      if (changed) await this.writeLocks(file.locks)
    })
  }

  async getLock(taskId: string): Promise<TaskLockHolder | null> {
    return this.mutex.run(async () => {
      const now = Math.floor(Date.now() / 1000)
      const file = await this.readLocks()
      const existing = file.locks[taskId]
      if (!existing || this.isStale(existing, now)) return null
      return existing
    })
  }
}
