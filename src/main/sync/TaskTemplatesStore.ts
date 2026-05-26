import fs from 'fs/promises'
import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import type { TaskTemplate, TaskTemplatesData } from '../../shared/types'
import { ExternalSyncHelper } from './ExternalSyncHelper'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'

type TemplatesListener = (templates: TaskTemplate[]) => void

function newTemplateId(): string {
  return `tpl_${Math.random().toString(36).slice(2, 9)}`
}

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl_monthly_report',
    name: 'Ежемесячный отчёт',
    title: 'Ежемесячный отчёт',
    description: '',
    type_id: 'type_general',
    priority_id: 'priority_normal',
    due_days_offset: 7,
    status: 'todo',
    checklist: []
  }
]

export class TaskTemplatesStore {
  private watcher: FSWatcher | null = null
  private listeners = new Set<TemplatesListener>()
  private templatesPath: string
  private cache: TaskTemplate[] = []
  private externalSync: ExternalSyncHelper

  constructor(private roomPath: string) {
    this.templatesPath = path.join(roomPath, 'sync', 'task_templates.json')
    this.externalSync = new ExternalSyncHelper(roomPath, 'templates')
  }

  onTemplatesChanged(listener: TemplatesListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(templates: TaskTemplate[]): void {
    this.cache = templates
    for (const listener of this.listeners) {
      listener(templates)
    }
  }

  static async createInitialFile(roomPath: string): Promise<void> {
    const p = path.join(roomPath, 'sync', 'task_templates.json')
    try {
      await fs.access(p)
    } catch {
      const data: TaskTemplatesData = {
        templates: DEFAULT_TEMPLATES,
        updated_at: Math.floor(Date.now() / 1000)
      }
      await fs.mkdir(path.dirname(p), { recursive: true })
      await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf-8')
    }
  }

  async ensureDefaults(): Promise<void> {
    await TaskTemplatesStore.createInitialFile(this.roomPath)
  }

  async start(): Promise<void> {
    await this.ensureDefaults()
    await this.loadAndEmit()
    this.watcher = chokidar.watch(this.templatesPath, {
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

  stop(): void {
    void this.watcher?.close()
    this.watcher = null
    this.listeners.clear()
  }

  private async read(): Promise<TaskTemplatesData> {
    const fallback: TaskTemplatesData = { templates: [], updated_at: 0 }
    const { data, ok } = await readJsonFile<TaskTemplatesData>(this.templatesPath, fallback)
    if (!ok) return fallback
    return { templates: data.templates ?? [], updated_at: data.updated_at ?? 0 }
  }

  private async writeTemplates(templates: TaskTemplate[]): Promise<void> {
    const data: TaskTemplatesData = {
      templates,
      updated_at: Math.floor(Date.now() / 1000)
    }
    await fs.mkdir(path.dirname(this.templatesPath), { recursive: true })
    await writeJsonFileAtomic(this.templatesPath, data)
    this.externalSync.markOwnWrite()
    this.emit(templates)
  }

  private async loadAndEmit(fromExternal = false): Promise<void> {
    const data = await this.read()
    this.emit(data.templates)
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  async reload(): Promise<void> {
    await this.loadAndEmit()
  }

  async getTemplates(): Promise<TaskTemplate[]> {
    if (this.cache.length > 0) return this.cache
    const data = await this.read()
    return data.templates
  }

  async saveTemplates(templates: TaskTemplate[]): Promise<TaskTemplate[]> {
    await this.writeTemplates(templates)
    return templates
  }

  createTemplate(partial: Omit<TaskTemplate, 'id'>): TaskTemplate {
    return { id: newTemplateId(), ...partial }
  }
}
