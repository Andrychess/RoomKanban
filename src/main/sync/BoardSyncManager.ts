import fs from 'fs/promises'
import path from 'path'
import { shell } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import { normalizeDueDateStorage } from '../../shared/dates'
import { parseTaskStatus } from '../../shared/taskStatus'
import { DEFAULT_TYPE_ID } from '../../shared/defaultTaskTypes'
import { DEFAULT_PRIORITY_ID } from '../../shared/defaultTaskPriorities'
import { buildHistoryEntries } from '../../shared/taskHistory'
import { isActiveTask, isArchivedTask } from '../../shared/tasks'
import { AsyncMutex } from './AsyncMutex'
import { ExternalSyncHelper } from './ExternalSyncHelper'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'
import {
  legacyBoardPath,
  syncTaskFilePath,
  syncTasksDir
} from './syncPaths'
import { assertTaskId, resolvePathInsideRoom } from './syncPathSecurity'
import type {
  BoardData,
  ChecklistItem,
  CreateTaskInput,
  Task,
  TaskComment,
  TaskFile,
  TaskFileKind,
  UpdateTaskInput
} from '../../shared/types'
import type { UpdateTaskResult } from '../../shared/syncEvents'
import type { TaskHistoryStore } from './TaskHistoryStore'
import type { TaskPrioritiesStore } from './TaskPrioritiesStore'
import type { TaskTypesStore } from './TaskTypesStore'

type TasksListener = (tasks: Task[]) => void

function newTaskId(): string {
  return `task_${Math.random().toString(36).slice(2, 11)}`
}

function newFileId(): string {
  return `f_${Math.random().toString(36).slice(2, 11)}`
}

function newCommentId(): string {
  return `cmt_${Math.random().toString(36).slice(2, 11)}`
}

function parseComments(raw: unknown): TaskComment[] {
  if (!Array.isArray(raw)) return []
  const result: TaskComment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const text = typeof o.text === 'string' ? o.text.trim() : ''
    if (!text) continue
    result.push({
      id: typeof o.id === 'string' ? o.id : newCommentId(),
      author_pc: String(o.author_pc ?? ''),
      author_name: String(o.author_name ?? ''),
      text,
      created_at: typeof o.created_at === 'number' ? o.created_at : Math.floor(Date.now() / 1000)
    })
  }
  return result
}

function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return []
  const result: ChecklistItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const text = typeof o.text === 'string' ? o.text.trim() : ''
    if (!text) continue
    result.push({
      id: typeof o.id === 'string' ? o.id : `chk_${Math.random().toString(36).slice(2, 9)}`,
      text,
      done: Boolean(o.done)
    })
  }
  return result
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

export class BoardSyncManager {
  private watcher: FSWatcher | null = null
  private listeners = new Set<TasksListener>()
  private tasksDir: string
  private docsPath: string
  private mutex = new AsyncMutex()
  private taskCache = new Map<string, Task>()
  private externalSync: ExternalSyncHelper

  constructor(
    private roomPath: string,
    private pcId: string,
    private taskTypes: TaskTypesStore,
    private taskPriorities: TaskPrioritiesStore,
    private history: TaskHistoryStore | null = null,
    private getActor: (() => { key: string; name: string }) | null = null
  ) {
    this.tasksDir = syncTasksDir(roomPath)
    this.docsPath = path.join(roomPath, 'docs')
    this.externalSync = new ExternalSyncHelper(roomPath, 'tasks')
  }

  onTasksChanged(listener: TasksListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(tasks: Task[]): void {
    for (const listener of this.listeners) {
      listener(tasks)
    }
  }

  private emitActiveFromCache(): void {
    this.emit(Array.from(this.taskCache.values()).filter(isActiveTask))
  }

  async start(): Promise<void> {
    await this.ensureDirs()
    if (!(await this.hasPerTaskStorage())) {
      await this.migrateFromBoardJson()
    }
    if (!(await this.hasPerTaskStorage())) {
      await this.migrateFromPcFiles()
    }
    await this.loadAllIntoCache()
    await this.loadAndEmit()

    this.watcher = chokidar.watch(this.tasksDir, {
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: this.externalSync.writeFinishOptions()
    })

    const onFsEvent = (filePath: string) => {
      if (this.externalSync.shouldIgnoreWatch()) return
      const base = path.basename(filePath)
      if (!base.endsWith('.json')) return
      const taskId = base.slice(0, -5)
      void this.refreshOneTask(taskId, true)
    }

    this.watcher.on('add', onFsEvent)
    this.watcher.on('change', onFsEvent)
    this.watcher.on('unlink', (filePath) => {
      if (this.externalSync.shouldIgnoreWatch()) return
      const taskId = path.basename(filePath, '.json')
      this.taskCache.delete(taskId)
      this.emitActiveFromCache()
      this.externalSync.notifyExternal(false)
    })
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.listeners.clear()
    this.taskCache.clear()
  }

  private async hasPerTaskStorage(): Promise<boolean> {
    try {
      const entries = await fs.readdir(this.tasksDir)
      return entries.some((n) => n.endsWith('.json'))
    } catch {
      return false
    }
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(path.join(this.roomPath, 'sync'), { recursive: true })
    await fs.mkdir(this.tasksDir, { recursive: true })
    await fs.mkdir(this.docsPath, { recursive: true })
  }

  private async migrateFromBoardJson(): Promise<void> {
    const boardPath = legacyBoardPath(this.roomPath)
    try {
      await fs.access(boardPath)
    } catch {
      return
    }

    const { data, ok } = await readJsonFile<BoardData>(boardPath, { tasks: [], updated_at: 0 })
    if (!ok || !data.tasks?.length) {
      return
    }

    const tasks = data.tasks.map((t) =>
      this.normalizeTask(t as unknown as Record<string, unknown> & { id: string })
    )
    await this.writeTasksToFiles(tasks)

    const migratedPath = `${boardPath}.migrated`
    try {
      await fs.rename(boardPath, migratedPath)
    } catch {
      /* already moved */
    }
  }

  private async migrateFromPcFiles(): Promise<void> {
    const syncDir = path.join(this.roomPath, 'sync')
    let entries: string[] = []
    try {
      entries = await fs.readdir(syncDir)
    } catch {
      return
    }

    const merged: Task[] = []
    for (const file of entries) {
      if (!file.startsWith('pc_') || !file.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(syncDir, file), 'utf-8')
        const data = JSON.parse(raw) as { tasks?: Array<Record<string, unknown>> }
        for (const t of data.tasks ?? []) {
          merged.push(this.legacyToTask(t, file.replace('.json', '')))
        }
      } catch {
        /* skip */
      }
    }

    if (merged.length > 0) {
      await this.writeTasksToFiles(merged)
    }
  }

  private async writeTasksToFiles(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await writeJsonFileAtomic(
        syncTaskFilePath(this.roomPath, task.id),
        this.taskToJson(task)
      )
      this.taskCache.set(task.id, task)
    }
    this.externalSync.markOwnWrite()
  }

  private normalizeTask(raw: Record<string, unknown> & { id: string }): Task {
    const now = Math.floor(Date.now() / 1000)
    const due = raw.due_date

    let source_files = parseFileList(raw.source_files)
    const completed_files = parseFileList(raw.completed_files)

    const legacyName = typeof raw.file_name === 'string' ? raw.file_name : null
    const legacyRel = typeof raw.file_rel === 'string' ? raw.file_rel : null
    if (source_files.length === 0 && legacyName && legacyRel) {
      source_files = [
        {
          id: newFileId(),
          file_name: legacyName,
          file_rel: legacyRel,
          added_at: Number(raw.updated_at ?? raw.created_at ?? now)
        }
      ]
    }

    const description =
      typeof raw.description === 'string'
        ? raw.description
        : typeof raw.comment === 'string'
          ? raw.comment
          : ''

    const archived =
      typeof raw.archived_at === 'number' && raw.archived_at > 0 ? raw.archived_at : null

    return {
      id: raw.id,
      title: String(raw.title ?? 'Без названия'),
      description,
      status: parseTaskStatus(raw.status),
      type_id: this.taskTypes.resolveTypeId(raw.type_id as string | undefined),
      priority_id: this.taskPriorities.resolvePriorityId(raw.priority_id as string | undefined),
      assignee_pc: String(raw.assignee_pc ?? this.pcId),
      due_date:
        typeof due === 'string' && due.length > 0 ? normalizeDueDateStorage(due.trim()) : null,
      source_files,
      completed_files,
      comments: parseComments(raw.comments),
      checklist: parseChecklist(raw.checklist),
      archived_at: archived,
      created_by_pc: String(raw.created_by_pc ?? this.pcId),
      created_at: Number(raw.created_at ?? now),
      updated_at: Number(raw.updated_at ?? now)
    }
  }

  private actor(): { key: string; name: string } {
    return this.getActor?.() ?? { key: this.pcId, name: 'Сотрудник' }
  }

  private async recordHistory(prev: Task | null, next: Task): Promise<void> {
    if (!this.history) return
    const { key, name } = this.actor()
    const drafts = buildHistoryEntries(prev, next, key, name)
    await this.history.appendMany(next.id, drafts)
  }

  private taskToJson(task: Task): Task & { comment: string } {
    return { ...task, comment: task.description }
  }

  private legacyToTask(raw: Record<string, unknown>, fallbackPc: string): Task {
    const now = Math.floor(Date.now() / 1000)
    return this.normalizeTask({
      id: String(raw.id ?? newTaskId()),
      title: String(raw.title ?? 'Без названия'),
      description: String(raw.description ?? raw.comment ?? ''),
      status: parseTaskStatus(raw.status),
      type_id: this.taskTypes.resolveTypeId(raw.type_id as string | undefined),
      priority_id: this.taskPriorities.resolvePriorityId(raw.priority_id as string | undefined),
      assignee_pc: String(raw.assignee_pc ?? fallbackPc),
      due_date: (raw.due_date as string) ?? null,
      source_files: [],
      completed_files: [],
      created_by_pc: fallbackPc,
      created_at: Number(raw.created_at ?? now),
      updated_at: Number(raw.updated_at ?? now)
    })
  }

  private async readTaskFromDisk(taskId: string): Promise<Task | null> {
    assertTaskId(taskId)
    const filePath = syncTaskFilePath(this.roomPath, taskId)
    const { data, ok } = await readJsonFile<Record<string, unknown>>(filePath, {})
    if (!ok || !data.id) return null
    return this.normalizeTask({ ...data, id: String(data.id ?? taskId) } as Record<string, unknown> & {
      id: string
    })
  }

  private async loadAllIntoCache(): Promise<void> {
    this.taskCache.clear()
    let entries: string[] = []
    try {
      entries = await fs.readdir(this.tasksDir)
    } catch {
      return
    }
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      const taskId = name.slice(0, -5)
      const task = await this.readTaskFromDisk(taskId)
      if (task) this.taskCache.set(task.id, task)
    }
  }

  private async refreshOneTask(taskId: string, fromExternal: boolean): Promise<void> {
    if (!/^task_[a-z0-9]+\.json$/.test(`${taskId}.json`)) return
    await this.mutex.run(async () => {
      try {
        const task = await this.readTaskFromDisk(taskId)
        if (task) this.taskCache.set(taskId, task)
        else this.taskCache.delete(taskId)
      } catch {
        /* invalid id or corrupt file */
      }
      this.emitActiveFromCache()
      if (fromExternal) {
        this.externalSync.notifyExternal(false)
      }
    })
  }

  private async loadAndEmit(fromExternal = false): Promise<void> {
    await this.loadAllIntoCache()
    this.emitActiveFromCache()
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  async reload(): Promise<void> {
    await this.loadAndEmit()
  }

  /**
   * Записывает одну задачу. При более новой версии на диске сохраняет её (merge) и возвращает true.
   */
  private async persistTask(task: Task, opts?: { force?: boolean }): Promise<boolean> {
    assertTaskId(task.id)
    const filePath = syncTaskFilePath(this.roomPath, task.id)
    let mergedFromRemote = false
    let toWrite = task

    if (!opts?.force) {
      const remote = await this.readTaskFromDisk(task.id)
      if (remote && remote.updated_at > task.updated_at) {
        toWrite = remote
        mergedFromRemote = true
      }
    }

    await writeJsonFileAtomic(filePath, this.taskToJson(toWrite))
    this.taskCache.set(toWrite.id, toWrite)
    this.externalSync.markOwnWrite()
    return mergedFromRemote
  }

  private async deleteTaskFile(taskId: string): Promise<void> {
    assertTaskId(taskId)
    try {
      await fs.unlink(syncTaskFilePath(this.roomPath, taskId))
    } catch {
      /* already gone */
    }
    this.taskCache.delete(taskId)
    this.externalSync.markOwnWrite()
  }

  async getAllTasks(): Promise<Task[]> {
    return this.mutex.run(async () => {
      if (this.taskCache.size === 0) {
        await this.loadAllIntoCache()
      }
      return Array.from(this.taskCache.values())
    })
  }

  async getTasks(): Promise<Task[]> {
    return (await this.getAllTasks()).filter(isActiveTask)
  }

  async getArchivedTasks(): Promise<Task[]> {
    return (await this.getAllTasks()).filter(isArchivedTask)
  }

  private async withBoardMutation<T>(fn: (tasks: Task[]) => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      if (this.taskCache.size === 0) {
        await this.loadAllIntoCache()
      }
      const tasks = Array.from(this.taskCache.values())
      const result = await fn(tasks)
      return result
    })
  }

  private taskDocsDir(taskId: string, kind: TaskFileKind): string {
    return path.join(this.docsPath, taskId, kind)
  }

  private async attachFile(
    taskId: string,
    kind: TaskFileKind,
    sourcePath: string
  ): Promise<TaskFile> {
    const baseName = path.basename(sourcePath)
    const fileId = newFileId()
    const storedName = `${fileId}_${baseName}`
    const destDir = this.taskDocsDir(taskId, kind)
    await fs.mkdir(destDir, { recursive: true })
    const destPath = path.join(destDir, storedName)
    await fs.copyFile(sourcePath, destPath)
    const file_rel = path.join('docs', taskId, kind, storedName).replace(/\\/g, '/')
    return {
      id: fileId,
      file_name: baseName,
      file_rel,
      added_at: Math.floor(Date.now() / 1000)
    }
  }

  private async attachFiles(
    taskId: string,
    kind: TaskFileKind,
    sourcePaths: string[]
  ): Promise<TaskFile[]> {
    const attached: TaskFile[] = []
    for (const sourcePath of sourcePaths) {
      if (!sourcePath.trim()) continue
      attached.push(await this.attachFile(taskId, kind, sourcePath))
    }
    return attached
  }

  private async deleteFileEntry(file: TaskFile): Promise<void> {
    const full = resolvePathInsideRoom(this.roomPath, file.file_rel)
    try {
      await fs.unlink(full)
    } catch {
      /* already gone */
    }
  }

  private async removeAllTaskDocs(taskId: string): Promise<void> {
    const dir = path.join(this.docsPath, taskId)
    try {
      await fs.rm(dir, { recursive: true, force: true })
    } catch {
      /* missing */
    }
  }

  private async applyFileUpdates(task: Task, input: UpdateTaskInput): Promise<Task> {
    let source_files = [...task.source_files]
    let completed_files = [...task.completed_files]

    const removeSource = new Set(input.remove_source_file_ids ?? [])
    const removeCompleted = new Set(input.remove_completed_file_ids ?? [])

    for (const file of source_files) {
      if (removeSource.has(file.id)) await this.deleteFileEntry(file)
    }
    for (const file of completed_files) {
      if (removeCompleted.has(file.id)) await this.deleteFileEntry(file)
    }

    source_files = source_files.filter((f) => !removeSource.has(f.id))
    completed_files = completed_files.filter((f) => !removeCompleted.has(f.id))

    if (input.add_source_files?.length) {
      const added = await this.attachFiles(task.id, 'source', input.add_source_files)
      source_files = [...source_files, ...added]
    }
    if (input.add_completed_files?.length) {
      const added = await this.attachFiles(task.id, 'completed', input.add_completed_files)
      completed_files = [...completed_files, ...added]
    }

    return { ...task, source_files, completed_files }
  }

  private async finishMutation(mergedFromRemote: boolean): Promise<void> {
    this.emitActiveFromCache()
    if (mergedFromRemote) {
      this.externalSync.notifyExternal(false, { merged: true })
    }
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.withBoardMutation(async () => {
      const now = Math.floor(Date.now() / 1000)
      const id = newTaskId()

      const source_files = await this.attachFiles(id, 'source', input.add_source_files ?? [])
      const completed_files = await this.attachFiles(id, 'completed', input.add_completed_files ?? [])

      const task: Task = {
        id,
        title: input.title.trim(),
        description: input.description.trim(),
        status: input.status ?? 'review',
        type_id: this.taskTypes.resolveTypeId(input.type_id),
        priority_id: this.taskPriorities.resolvePriorityId(input.priority_id),
        assignee_pc: input.assignee_pc,
        due_date: normalizeDueDateStorage(input.due_date ?? null),
        source_files,
        completed_files,
        comments: [],
        checklist: input.checklist ?? [],
        archived_at: null,
        created_by_pc: this.pcId,
        created_at: now,
        updated_at: now
      }

      await this.persistTask(task, { force: true })
      await this.recordHistory(null, task)
      this.emitActiveFromCache()
      return task
    })
  }

  async updateTask(input: UpdateTaskInput): Promise<UpdateTaskResult> {
    return this.withBoardMutation(async (tasks) => {
      const idx = tasks.findIndex((t) => t.id === input.id)
      if (idx === -1) throw new Error('Задача не найдена')

      if (!input.force_overwrite && input.client_base_updated_at != null) {
        const remote = await this.readTaskFromDisk(input.id)
        if (remote && remote.updated_at > input.client_base_updated_at) {
          return { status: 'conflict', remoteTask: remote }
        }
      }

      const prev = tasks[idx]
      const withFiles = await this.applyFileUpdates(prev, input)

      const updated: Task = {
        ...withFiles,
        title: input.title.trim(),
        description: input.description.trim(),
        assignee_pc: input.assignee_pc,
        type_id: this.taskTypes.resolveTypeId(input.type_id),
        priority_id: this.taskPriorities.resolvePriorityId(input.priority_id),
        due_date: normalizeDueDateStorage(input.due_date ?? null),
        status: input.status,
        checklist: input.checklist ?? prev.checklist,
        updated_at: Math.floor(Date.now() / 1000)
      }

      const merged = await this.persistTask(updated, { force: input.force_overwrite })
      await this.recordHistory(prev, this.taskCache.get(updated.id) ?? updated)
      await this.finishMutation(merged)
      return { status: 'ok', task: this.taskCache.get(updated.id) ?? updated }
    })
  }

  async addTaskComment(taskId: string, text: string): Promise<Task> {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('Введите текст комментария')
    return this.withBoardMutation(async (tasks) => {
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx === -1) throw new Error('Задача не найдена')

      const prev = tasks[idx]
      const { key, name } = this.actor()
      const now = Math.floor(Date.now() / 1000)
      const comment: TaskComment = {
        id: newCommentId(),
        author_pc: key,
        author_name: name,
        text: trimmed,
        created_at: now
      }

      const updated: Task = {
        ...prev,
        comments: [...prev.comments, comment],
        updated_at: now
      }
      const merged = await this.persistTask(updated, { force: true })
      await this.recordHistory(prev, this.taskCache.get(updated.id) ?? updated)
      await this.finishMutation(merged)
      return this.taskCache.get(updated.id) ?? updated
    })
  }

  async updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
    await this.withBoardMutation(async (tasks) => {
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx === -1) return
      const prev = tasks[idx]
      const updated: Task = {
        ...prev,
        status,
        updated_at: Math.floor(Date.now() / 1000)
      }
      const merged = await this.persistTask(updated, { force: true })
      await this.recordHistory(prev, this.taskCache.get(updated.id) ?? updated)
      await this.finishMutation(merged)
    })
  }

  async archiveDoneTasks(): Promise<number> {
    return this.withBoardMutation(async (tasks) => {
      const now = Math.floor(Date.now() / 1000)
      let count = 0
      let anyMerged = false
      for (const task of tasks) {
        if (task.status === 'done' && !task.archived_at) {
          const prev = { ...task }
          task.archived_at = now
          task.updated_at = now
          count++
          await this.recordHistory(prev, task)
          if (await this.persistTask(task, { force: true })) anyMerged = true
        }
      }
      if (count > 0) await this.finishMutation(anyMerged)
      return count
    })
  }

  async restoreArchivedTask(taskId: string): Promise<Task> {
    return this.withBoardMutation(async (tasks) => {
      const idx = tasks.findIndex((t) => t.id === taskId)
      if (idx === -1) throw new Error('Задача не найдена')
      const prev = tasks[idx]
      if (!prev.archived_at) return prev
      const updated: Task = {
        ...prev,
        archived_at: null,
        updated_at: Math.floor(Date.now() / 1000)
      }
      const merged = await this.persistTask(updated, { force: true })
      await this.recordHistory(prev, this.taskCache.get(updated.id) ?? updated)
      await this.finishMutation(merged)
      return this.taskCache.get(updated.id) ?? updated
    })
  }

  async deleteArchivedTask(taskId: string): Promise<void> {
    return this.withBoardMutation(async (tasks) => {
      const task = tasks.find((t) => t.id === taskId)
      if (!task) throw new Error('Задача не найдена')
      if (!task.archived_at) {
        throw new Error('Удалять можно только задачи из архива')
      }

      for (const file of task.source_files) {
        await this.deleteFileEntry(file)
      }
      for (const file of task.completed_files) {
        await this.deleteFileEntry(file)
      }
      await this.removeAllTaskDocs(task.id)
      await this.deleteTaskFile(task.id)
      if (this.history) {
        await this.history.deleteForTask(taskId)
      }
      this.emitActiveFromCache()
      this.externalSync.notifyExternal(false)
    })
  }

  /** @deprecated используйте archiveDoneTasks */
  async clearTasksByStatus(status: Task['status']): Promise<number> {
    if (status === 'done') return this.archiveDoneTasks()
    return this.withBoardMutation(async (tasks) => {
      const toRemove = tasks.filter((t) => t.status === status && !t.archived_at)
      if (toRemove.length === 0) return 0
      for (const task of toRemove) {
        await this.removeAllTaskDocs(task.id)
        await this.deleteTaskFile(task.id)
      }
      this.emitActiveFromCache()
      return toRemove.length
    })
  }

  async reassignOrphanTypes(validIds: string[], fallbackId: string): Promise<void> {
    const valid = new Set(validIds)
    const fallback = valid.has(fallbackId) ? fallbackId : validIds[0] ?? DEFAULT_TYPE_ID
    await this.withBoardMutation(async (tasks) => {
      let anyMerged = false
      for (const task of tasks) {
        if (!valid.has(task.type_id)) {
          task.type_id = fallback
          task.updated_at = Math.floor(Date.now() / 1000)
          if (await this.persistTask(task, { force: true })) anyMerged = true
        }
      }
      if (anyMerged) await this.finishMutation(true)
      else this.emitActiveFromCache()
    })
  }

  async reassignOrphanPriorities(validIds: string[], fallbackId: string): Promise<void> {
    const valid = new Set(validIds)
    const fallback = valid.has(fallbackId) ? fallbackId : validIds[0] ?? DEFAULT_PRIORITY_ID
    await this.withBoardMutation(async (tasks) => {
      let anyMerged = false
      for (const task of tasks) {
        if (!valid.has(task.priority_id)) {
          task.priority_id = fallback
          task.updated_at = Math.floor(Date.now() / 1000)
          if (await this.persistTask(task, { force: true })) anyMerged = true
        }
      }
      if (anyMerged) await this.finishMutation(true)
      else this.emitActiveFromCache()
    })
  }

  async reassignEmployeeTasks(fromKey: string, toKey: string): Promise<void> {
    await this.withBoardMutation(async (tasks) => {
      let changed = false
      let anyMerged = false
      const now = Math.floor(Date.now() / 1000)
      for (const task of tasks) {
        if (task.assignee_pc === fromKey || task.created_by_pc === fromKey) {
          if (task.assignee_pc === fromKey) task.assignee_pc = toKey
          if (task.created_by_pc === fromKey) task.created_by_pc = toKey
          task.updated_at = now
          changed = true
          if (await this.persistTask(task, { force: true })) anyMerged = true
        }
      }
      if (changed) await this.finishMutation(anyMerged)
    })
  }

  async openTaskFile(taskId: string, kind: TaskFileKind, fileId: string): Promise<void> {
    const tasks = await this.getAllTasks()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) throw new Error('Задача не найдена')

    const files = kind === 'source' ? task.source_files : task.completed_files
    const file = files.find((f) => f.id === fileId)
    if (!file) throw new Error('Файл не найден')

    const full = resolvePathInsideRoom(this.roomPath, file.file_rel)
    await shell.openPath(full)
  }
}
