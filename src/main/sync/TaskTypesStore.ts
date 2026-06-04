import fs from 'fs/promises'
import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import { DEFAULT_TASK_TYPES, DEFAULT_TYPE_ID } from '../../shared/defaultTaskTypes'
import type { TaskType, TaskTypesData } from '../../shared/types'
import { ExternalSyncHelper } from './ExternalSyncHelper'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'

type TypesListener = (types: TaskType[]) => void

function newTypeId(): string {
  return `type_${Math.random().toString(36).slice(2, 9)}`
}

export class TaskTypesStore {
  private watcher: FSWatcher | null = null
  private listeners = new Set<TypesListener>()
  private typesPath: string
  private cache: TaskType[] = DEFAULT_TASK_TYPES
  private externalSync: ExternalSyncHelper

  constructor(private roomPath: string) {
    this.typesPath = path.join(roomPath, 'sync', 'task_types.json')
    this.externalSync = new ExternalSyncHelper(roomPath, 'types')
  }

  onTypesChanged(listener: TypesListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(types: TaskType[]): void {
    this.cache = types
    for (const listener of this.listeners) {
      listener(types)
    }
  }

  async ensureDefaults(): Promise<void> {
    try {
      await fs.access(this.typesPath)
    } catch {
      await this.writeTypes(DEFAULT_TASK_TYPES)
    }
  }

  async start(): Promise<void> {
    await this.ensureDefaults()
    await this.loadAndEmit()

    this.watcher = chokidar.watch(this.typesPath, {
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

  private async read(): Promise<TaskTypesData> {
    const fallback: TaskTypesData = {
      types: DEFAULT_TASK_TYPES,
      updated_at: Math.floor(Date.now() / 1000)
    }
    const { data, ok } = await readJsonFile<TaskTypesData>(this.typesPath, fallback)
    if (!ok || !Array.isArray(data.types) || data.types.length === 0) {
      return fallback
    }
    return data
  }

  private async writeTypes(types: TaskType[]): Promise<void> {
    const data: TaskTypesData = {
      types,
      updated_at: Math.floor(Date.now() / 1000)
    }
    await fs.mkdir(path.dirname(this.typesPath), { recursive: true })
    await writeJsonFileAtomic(this.typesPath, data)
    this.externalSync.markOwnWrite()
    this.emit(types)
  }

  private async loadAndEmit(fromExternal = false): Promise<void> {
    const data = await this.read()
    this.emit(data.types)
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  async reload(): Promise<void> {
    await this.loadAndEmit()
  }

  async getTypes(): Promise<TaskType[]> {
    const data = await this.read()
    return data.types
  }

  getCachedTypes(): TaskType[] {
    return this.cache
  }

  resolveTypeId(typeId: string | null | undefined): string {
    if (typeId && this.cache.some((t) => t.id === typeId)) return typeId
    return this.cache[0]?.id ?? DEFAULT_TYPE_ID
  }

  async saveTypes(types: TaskType[]): Promise<void> {
    if (types.length === 0) {
      throw new Error('Должен остаться хотя бы один вид задачи')
    }
    for (const t of types) {
      if (!t.name.trim()) throw new Error('Название вида не может быть пустым')
      if (!/^#[0-9A-Fa-f]{6}$/.test(t.color)) {
        throw new Error(`Некорректный цвет для «${t.name}»`)
      }
    }
    const normalized = types.map((t) => ({
      id: t.id || newTypeId(),
      name: t.name.trim(),
      color: t.color.toLowerCase()
    }))
    await this.writeTypes(normalized)
  }

  static async createInitialFile(roomPath: string): Promise<void> {
    const store = new TaskTypesStore(roomPath)
    await store.saveTypes(DEFAULT_TASK_TYPES)
  }
}
