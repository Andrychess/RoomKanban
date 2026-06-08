import fs from 'fs/promises'
import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import type { RoomNote, RoomNotesData } from '../../shared/types'
import { ExternalSyncHelper } from './ExternalSyncHelper'
import { readJsonFile, writeJsonFileAtomic } from './jsonFile'

type NotesListener = (notes: RoomNote[]) => void

function newNoteId(): string {
  return `note_${Math.random().toString(36).slice(2, 11)}`
}

function parseNotes(raw: unknown): RoomNote[] {
  if (!Array.isArray(raw)) return []
  const result: RoomNote[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const text = typeof o.text === 'string' ? o.text : ''
    if (!title && !text) continue
    result.push({
      id: typeof o.id === 'string' ? o.id : newNoteId(),
      title,
      text,
      created_at: typeof o.created_at === 'number' ? o.created_at : Math.floor(Date.now() / 1000),
      updated_at: typeof o.updated_at === 'number' ? o.updated_at : Math.floor(Date.now() / 1000),
      created_by_pc: typeof o.created_by_pc === 'string' ? o.created_by_pc : undefined
    })
  }
  return result.sort((a, b) => b.updated_at - a.updated_at)
}

export class NotesStore {
  private watcher: FSWatcher | null = null
  private listeners = new Set<NotesListener>()
  private notesPath: string
  private cache: RoomNote[] = []
  private externalSync: ExternalSyncHelper

  constructor(private roomPath: string) {
    this.notesPath = path.join(roomPath, 'sync', 'notes.json')
    this.externalSync = new ExternalSyncHelper(roomPath, 'notes')
  }

  onNotesChanged(listener: NotesListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(notes: RoomNote[]): void {
    this.cache = notes
    for (const listener of this.listeners) {
      listener(notes)
    }
  }

  static async createInitialFile(roomPath: string): Promise<void> {
    const p = path.join(roomPath, 'sync', 'notes.json')
    try {
      await fs.access(p)
    } catch {
      const data: RoomNotesData = { notes: [], updated_at: Math.floor(Date.now() / 1000) }
      await fs.mkdir(path.dirname(p), { recursive: true })
      await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf-8')
    }
  }

  async ensureDefaults(): Promise<void> {
    await NotesStore.createInitialFile(this.roomPath)
  }

  async start(): Promise<void> {
    await this.ensureDefaults()
    await this.loadAndEmit()
    this.watcher = chokidar.watch(this.notesPath, {
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
    this.cache = []
  }

  private async read(): Promise<RoomNotesData> {
    const fallback: RoomNotesData = { notes: [], updated_at: 0 }
    const { data, ok } = await readJsonFile<RoomNotesData>(this.notesPath, fallback)
    if (!ok) return fallback
    return {
      notes: parseNotes(data.notes),
      updated_at: data.updated_at ?? 0
    }
  }

  private async writeNotes(notes: RoomNote[]): Promise<void> {
    const sorted = [...notes].sort((a, b) => b.updated_at - a.updated_at)
    const data: RoomNotesData = {
      notes: sorted,
      updated_at: Math.floor(Date.now() / 1000)
    }
    await fs.mkdir(path.dirname(this.notesPath), { recursive: true })
    await writeJsonFileAtomic(this.notesPath, data)
    this.externalSync.markOwnWrite()
    this.emit(sorted)
  }

  private async loadAndEmit(fromExternal = false): Promise<void> {
    const data = await this.read()
    this.emit(data.notes)
    if (fromExternal) {
      this.externalSync.notifyExternal(false)
    }
  }

  async reload(): Promise<void> {
    await this.loadAndEmit()
  }

  async getNotes(): Promise<RoomNote[]> {
    if (this.cache.length > 0) return this.cache
    const data = await this.read()
    return data.notes
  }

  async addNote(title: string, text: string, authorPc: string): Promise<RoomNote> {
    const trimmedTitle = title.trim()
    const trimmedText = text.trim()
    if (!trimmedTitle) throw new Error('Укажите название заметки')

    const data = await this.read()
    const now = Math.floor(Date.now() / 1000)
    const note: RoomNote = {
      id: newNoteId(),
      title: trimmedTitle,
      text: trimmedText,
      created_at: now,
      updated_at: now,
      created_by_pc: authorPc
    }
    await this.writeNotes([note, ...data.notes])
    return note
  }

  async updateNote(id: string, title: string, text: string): Promise<RoomNote> {
    const trimmedTitle = title.trim()
    const trimmedText = text.trim()
    if (!trimmedTitle) throw new Error('Укажите название заметки')

    const data = await this.read()
    const idx = data.notes.findIndex((n) => n.id === id)
    if (idx === -1) throw new Error('Заметка не найдена')

    const now = Math.floor(Date.now() / 1000)
    const updated: RoomNote = {
      ...data.notes[idx],
      title: trimmedTitle,
      text: trimmedText,
      updated_at: now
    }
    const next = [...data.notes]
    next[idx] = updated
    await this.writeNotes(next)
    return updated
  }

  async deleteNote(id: string): Promise<void> {
    const data = await this.read()
    const next = data.notes.filter((n) => n.id !== id)
    if (next.length === data.notes.length) throw new Error('Заметка не найдена')
    await this.writeNotes(next)
  }
}
