import fs from 'fs/promises'
import path from 'path'
import { shell } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import type { TaskFile } from '../../shared/types'
import { AsyncMutex } from './AsyncMutex'
import { ExternalSyncHelper } from './ExternalSyncHelper'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'
import {
  legacyExchangePath,
  syncExchangeDir,
  syncExchangeFilePath
} from './syncPaths'
import { assertEmployeeKey, resolvePathInsideRoom } from './syncPathSecurity'

type ExchangeListener = (data: Record<string, TaskFile[]>) => void

interface EmployeeExchangeData {
  files: TaskFile[]
  updated_at: number
}

function newFileId(): string {
  return `ex_${Math.random().toString(36).slice(2, 11)}`
}

function parseFileList(raw: unknown): TaskFile[] {
  if (!Array.isArray(raw)) return []
  const result: TaskFile[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const file_name = typeof o.file_name === 'string' ? o.file_name : ''
    const file_rel = typeof o.file_rel === 'string' ? o.file_rel : ''
    if (!file_name || !file_rel) continue
    result.push({
      id: typeof o.id === 'string' ? o.id : newFileId(),
      file_name,
      file_rel,
      added_at: typeof o.added_at === 'number' ? o.added_at : Math.floor(Date.now() / 1000)
    })
  }
  return result
}

function mergeFileLists(preferred: TaskFile[], remote: TaskFile[]): TaskFile[] {
  const map = new Map<string, TaskFile>()
  for (const f of remote) {
    map.set(f.id, f)
  }
  for (const f of preferred) {
    const ex = map.get(f.id)
    if (!ex || f.added_at >= ex.added_at) {
      map.set(f.id, f)
    }
  }
  return Array.from(map.values())
}

export class ExchangeStore {
  private watcher: FSWatcher | null = null
  private listeners = new Set<ExchangeListener>()
  private exchangeDir: string
  private docsExchangePath: string
  private mutex = new AsyncMutex()
  private cache: Record<string, TaskFile[]> | null = null
  private externalSync: ExternalSyncHelper

  constructor(private roomPath: string) {
    this.exchangeDir = syncExchangeDir(roomPath)
    this.docsExchangePath = path.join(roomPath, 'docs', 'exchange')
    this.externalSync = new ExternalSyncHelper(roomPath, 'exchange')
  }

  onExchangeChanged(listener: ExchangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(data: Record<string, TaskFile[]>): void {
    this.cache = data
    for (const listener of this.listeners) {
      listener(data)
    }
  }

  async ensureDefaults(): Promise<void> {
    await fs.mkdir(path.join(this.roomPath, 'sync'), { recursive: true })
    await fs.mkdir(this.exchangeDir, { recursive: true })
    await fs.mkdir(this.docsExchangePath, { recursive: true })
  }

  private async hasPerEmployeeStorage(): Promise<boolean> {
    try {
      const entries = await fs.readdir(this.exchangeDir)
      return entries.some((n) => n.endsWith('.json'))
    } catch {
      return false
    }
  }

  private async migrateFromLegacyExchange(): Promise<void> {
    const legacyPath = legacyExchangePath(this.roomPath)
    try {
      await fs.access(legacyPath)
    } catch {
      return
    }

    const { data, ok } = await readJsonFile<{ files?: Record<string, unknown[]>; updated_at?: number }>(
      legacyPath,
      { files: {} }
    )
    if (!ok) return

    for (const [employeeKey, list] of Object.entries(data.files ?? {})) {
      const files = parseFileList(list)
      await this.writeEmployee(employeeKey, files)
    }

    const migratedPath = `${legacyPath}.migrated`
    try {
      await fs.rename(legacyPath, migratedPath)
    } catch {
      /* already moved */
    }
    this.externalSync.markOwnWrite()
  }

  async start(): Promise<void> {
    await this.ensureDefaults()
    if (!(await this.hasPerEmployeeStorage())) {
      await this.migrateFromLegacyExchange()
    }
    await this.loadAndEmit()

    this.watcher = chokidar.watch(this.exchangeDir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: this.externalSync.writeFinishOptions()
    })

    const onFsEvent = (filePath: string) => {
      if (this.externalSync.shouldIgnoreWatch()) return
      const base = path.basename(filePath)
      if (!base.endsWith('.json')) return
      const employeeKey = base.slice(0, -5)
      void this.refreshOneEmployee(employeeKey, true)
    }

    this.watcher.on('add', onFsEvent)
    this.watcher.on('change', onFsEvent)
    this.watcher.on('unlink', (filePath) => {
      if (this.externalSync.shouldIgnoreWatch()) return
      const employeeKey = path.basename(filePath, '.json')
      if (this.cache) {
        delete this.cache[employeeKey]
        this.emit({ ...this.cache })
      }
      this.externalSync.notifyExternal(false)
    })
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.listeners.clear()
    this.cache = null
  }

  private async readEmployee(employeeKey: string): Promise<TaskFile[]> {
    assertEmployeeKey(employeeKey)
    const filePath = syncExchangeFilePath(this.roomPath, employeeKey)
    const { data, ok } = await readJsonFile<EmployeeExchangeData>(filePath, {
      files: [],
      updated_at: 0
    })
    if (!ok) return []
    return parseFileList(data.files)
  }

  private async writeEmployee(employeeKey: string, files: TaskFile[]): Promise<void> {
    assertEmployeeKey(employeeKey)
    const payload: EmployeeExchangeData = {
      files,
      updated_at: Math.floor(Date.now() / 1000)
    }
    if (files.length === 0) {
      try {
        await fs.unlink(syncExchangeFilePath(this.roomPath, employeeKey))
      } catch {
        /* no file yet */
      }
      if (this.cache) {
        delete this.cache[employeeKey]
      }
    } else {
      await writeJsonFileAtomic(syncExchangeFilePath(this.roomPath, employeeKey), payload)
      if (this.cache) {
        this.cache[employeeKey] = files
      }
    }
    this.externalSync.markOwnWrite()
  }

  private async readAll(): Promise<Record<string, TaskFile[]>> {
    const out: Record<string, TaskFile[]> = {}
    let entries: string[] = []
    try {
      entries = await fs.readdir(this.exchangeDir)
    } catch {
      return out
    }
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      const employeeKey = name.slice(0, -5)
      const files = await this.readEmployee(employeeKey)
      if (files.length > 0) {
        out[employeeKey] = files
      }
    }
    return out
  }

  private async refreshOneEmployee(employeeKey: string, fromExternal: boolean): Promise<void> {
    const files = await this.readEmployee(employeeKey)
    const next = { ...(this.cache ?? {}) }
    if (files.length === 0) {
      delete next[employeeKey]
    } else {
      next[employeeKey] = files
    }
    this.emit(next)
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  private async loadAndEmit(fromExternal = false): Promise<void> {
    const data = await this.readAll()
    this.emit(data)
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  async reload(): Promise<void> {
    await this.loadAndEmit()
  }

  async getAll(): Promise<Record<string, TaskFile[]>> {
    if (this.cache !== null) return this.cache
    const data = await this.readAll()
    this.cache = data
    return data
  }

  private employeeDir(employeeKey: string): string {
    assertEmployeeKey(employeeKey)
    return path.join(this.docsExchangePath, employeeKey)
  }

  private async attachFile(employeeKey: string, sourcePath: string): Promise<TaskFile> {
    const baseName = path.basename(sourcePath)
    const fileId = newFileId()
    const storedName = `${fileId}_${baseName}`
    const destDir = this.employeeDir(employeeKey)
    await fs.mkdir(destDir, { recursive: true })
    await fs.copyFile(sourcePath, path.join(destDir, storedName))
    const file_rel = path.join('docs', 'exchange', employeeKey, storedName).replace(/\\/g, '/')
    return {
      id: fileId,
      file_name: baseName,
      file_rel,
      added_at: Math.floor(Date.now() / 1000)
    }
  }

  private async deleteFileEntry(file: TaskFile): Promise<void> {
    const full = resolvePathInsideRoom(this.roomPath, file.file_rel)
    try {
      await fs.unlink(full)
    } catch {
      /* already gone */
    }
  }

  private async persistEmployee(employeeKey: string, preferred: TaskFile[]): Promise<void> {
    const remote = await this.readEmployee(employeeKey)
    const merged = mergeFileLists(preferred, remote)
    await this.writeEmployee(employeeKey, merged)
    const next = { ...(this.cache ?? {}), [employeeKey]: merged }
    if (merged.length === 0) {
      delete next[employeeKey]
    }
    this.emit(next)
  }

  async addFiles(employeeKey: string, sourcePaths: string[]): Promise<TaskFile[]> {
    return this.mutex.run(async () => {
      const list = await this.readEmployee(employeeKey)
      const added: TaskFile[] = []
      for (const sourcePath of sourcePaths) {
        if (!sourcePath.trim()) continue
        added.push(await this.attachFile(employeeKey, sourcePath))
      }
      if (added.length === 0) return []
      await this.persistEmployee(employeeKey, [...list, ...added])
      return added
    })
  }

  async clearEmployee(employeeKey: string): Promise<number> {
    return this.mutex.run(async () => {
      const list = await this.readEmployee(employeeKey)
      for (const file of list) {
        await this.deleteFileEntry(file)
      }
      await this.writeEmployee(employeeKey, [])
      const next = { ...(this.cache ?? {}) }
      delete next[employeeKey]
      this.emit(next)
      return list.length
    })
  }

  async removeFile(employeeKey: string, fileId: string): Promise<void> {
    await this.mutex.run(async () => {
      const list = await this.readEmployee(employeeKey)
      const file = list.find((f) => f.id === fileId)
      if (!file) return
      await this.deleteFileEntry(file)
      const remaining = list.filter((f) => f.id !== fileId)
      await this.persistEmployee(employeeKey, remaining)
    })
  }

  async openFile(employeeKey: string, fileId: string): Promise<void> {
    const list = await this.readEmployee(employeeKey)
    const file = list.find((f) => f.id === fileId)
    if (!file) throw new Error('Файл не найден')
    const full = resolvePathInsideRoom(this.roomPath, file.file_rel)
    await shell.openPath(full)
  }
}
