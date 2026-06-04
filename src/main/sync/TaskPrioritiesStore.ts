import fs from 'fs/promises'
import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import { DEFAULT_PRIORITY_ID, DEFAULT_TASK_PRIORITIES } from '../../shared/defaultTaskPriorities'
import type { TaskPrioritiesData, TaskPriority } from '../../shared/types'
import { ExternalSyncHelper } from './ExternalSyncHelper'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'

type PrioritiesListener = (priorities: TaskPriority[]) => void

function newPriorityId(): string {
  return `priority_${Math.random().toString(36).slice(2, 9)}`
}

export class TaskPrioritiesStore {
  private watcher: FSWatcher | null = null
  private listeners = new Set<PrioritiesListener>()
  private prioritiesPath: string
  private cache: TaskPriority[] = DEFAULT_TASK_PRIORITIES
  private externalSync: ExternalSyncHelper

  constructor(private roomPath: string) {
    this.prioritiesPath = path.join(roomPath, 'sync', 'task_priorities.json')
    this.externalSync = new ExternalSyncHelper(roomPath, 'priorities')
  }

  onPrioritiesChanged(listener: PrioritiesListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(priorities: TaskPriority[]): void {
    this.cache = priorities
    for (const listener of this.listeners) {
      listener(priorities)
    }
  }

  async ensureDefaults(): Promise<void> {
    try {
      await fs.access(this.prioritiesPath)
    } catch {
      await this.writePriorities(DEFAULT_TASK_PRIORITIES)
    }
  }

  async start(): Promise<void> {
    await this.ensureDefaults()
    await this.loadAndEmit()

    this.watcher = chokidar.watch(this.prioritiesPath, {
      ignoreInitial: true,
      awaitWriteFinish: this.externalSync.writeFinishOptions()
    })
    const onExternal = () => {
      if (this.externalSync.shouldIgnoreWatch()) return
      void this.loadAndEmit(true)
    }
    this.watcher.on('change', onExternal)
    this.watcher.on('add', onExternal)
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.listeners.clear()
  }

  private async read(): Promise<TaskPrioritiesData> {
    const fallback: TaskPrioritiesData = {
      priorities: DEFAULT_TASK_PRIORITIES,
      updated_at: Math.floor(Date.now() / 1000)
    }
    const { data, ok } = await readJsonFile<TaskPrioritiesData>(this.prioritiesPath, fallback)
    if (!ok || !Array.isArray(data.priorities) || data.priorities.length === 0) {
      return fallback
    }
    return data
  }

  private async writePriorities(priorities: TaskPriority[]): Promise<void> {
    const data: TaskPrioritiesData = {
      priorities,
      updated_at: Math.floor(Date.now() / 1000)
    }
    await fs.mkdir(path.dirname(this.prioritiesPath), { recursive: true })
    await writeJsonFileAtomic(this.prioritiesPath, data)
    this.externalSync.markOwnWrite()
    this.emit(priorities)
  }

  private async loadAndEmit(fromExternal = false): Promise<void> {
    const data = await this.read()
    this.emit(data.priorities)
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  async reload(): Promise<void> {
    await this.loadAndEmit()
  }

  async getPriorities(): Promise<TaskPriority[]> {
    const data = await this.read()
    return data.priorities
  }

  resolvePriorityId(priorityId: string | null | undefined): string {
    if (priorityId && this.cache.some((p) => p.id === priorityId)) return priorityId
    return this.cache.find((p) => p.id === DEFAULT_PRIORITY_ID)?.id ?? this.cache[0]?.id ?? DEFAULT_PRIORITY_ID
  }

  async savePriorities(priorities: TaskPriority[]): Promise<void> {
    if (priorities.length === 0) {
      throw new Error('Должен остаться хотя бы один приоритет')
    }
    for (const p of priorities) {
      if (!p.name.trim()) throw new Error('Название приоритета не может быть пустым')
      if (!/^#[0-9A-Fa-f]{6}$/.test(p.color)) {
        throw new Error(`Некорректный цвет для «${p.name}»`)
      }
    }
    const normalized = priorities.map((p) => ({
      id: p.id || newPriorityId(),
      name: p.name.trim(),
      color: p.color.toLowerCase()
    }))
    await this.writePriorities(normalized)
  }

  static async createInitialFile(roomPath: string): Promise<void> {
    const store = new TaskPrioritiesStore(roomPath)
    await store.savePriorities(DEFAULT_TASK_PRIORITIES)
  }
}
