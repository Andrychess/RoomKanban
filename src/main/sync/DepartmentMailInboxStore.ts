import fs from 'fs/promises'
import path from 'path'
import type { DepartmentMailInboxData, DepartmentMailMessage } from '../../shared/departmentMail'

const EMPTY: DepartmentMailInboxData = {
  messages: [],
  updated_at: 0
}

function parseMessage(raw: unknown): DepartmentMailMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : ''
  const uid = typeof o.uid === 'number' ? o.uid : 0
  if (!id || uid <= 0) return null
  const status = o.status
  const validStatus =
    status === 'pending' || status === 'discarded' || status === 'task_created'
      ? status
      : 'pending'
  return {
    id,
    uid,
    message_id: typeof o.message_id === 'string' ? o.message_id : '',
    subject: typeof o.subject === 'string' ? o.subject : '',
    from: typeof o.from === 'string' ? o.from : '',
    date: typeof o.date === 'string' ? o.date : '',
    body_preview: typeof o.body_preview === 'string' ? o.body_preview : '',
    attachment_count: typeof o.attachment_count === 'number' ? o.attachment_count : 0,
    attachment_names: Array.isArray(o.attachment_names)
      ? o.attachment_names.filter((x): x is string => typeof x === 'string')
      : [],
    status: validStatus,
    task_id: typeof o.task_id === 'string' ? o.task_id : null,
    fetched_at: typeof o.fetched_at === 'number' ? o.fetched_at : 0
  }
}

export class DepartmentMailInboxStore {
  private inboxPath: string
  private cache: DepartmentMailInboxData = EMPTY

  constructor(private roomPath: string) {
    this.inboxPath = path.join(roomPath, 'sync', 'department_mail_inbox.json')
  }

  async ensureDefaults(): Promise<void> {
    try {
      await fs.access(this.inboxPath)
    } catch {
      await this.write(EMPTY)
    }
  }

  private async read(): Promise<DepartmentMailInboxData> {
    try {
      const raw = await fs.readFile(this.inboxPath, 'utf-8')
      const data = JSON.parse(raw) as Partial<DepartmentMailInboxData>
      const messages: DepartmentMailMessage[] = []
      if (Array.isArray(data.messages)) {
        for (const item of data.messages) {
          const parsed = parseMessage(item)
          if (parsed) messages.push(parsed)
        }
      }
      return {
        messages,
        updated_at: data.updated_at ?? 0
      }
    } catch {
      return { ...EMPTY }
    }
  }

  private async write(data: DepartmentMailInboxData): Promise<void> {
    const next = { ...data, updated_at: Math.floor(Date.now() / 1000) }
    await fs.mkdir(path.dirname(this.inboxPath), { recursive: true })
    await fs.writeFile(this.inboxPath, JSON.stringify(next, null, 2), 'utf-8')
    this.cache = next
  }

  async getInbox(): Promise<DepartmentMailInboxData> {
    this.cache = await this.read()
    return this.cache
  }

  getKnownIds(): Set<string> {
    return new Set(this.cache.messages.map((m) => m.id))
  }

  async addMessages(messages: DepartmentMailMessage[]): Promise<DepartmentMailInboxData> {
    const current = await this.getInbox()
    const known = new Set(current.messages.map((m) => m.id))
    const merged = [...current.messages]
    for (const msg of messages) {
      if (known.has(msg.id)) continue
      merged.push(msg)
      known.add(msg.id)
    }
    merged.sort((a, b) => b.date.localeCompare(a.date))
    await this.write({ messages: merged, updated_at: 0 })
    return this.cache
  }

  async updateMessage(
    id: string,
    patch: Partial<Pick<DepartmentMailMessage, 'status' | 'task_id'>>
  ): Promise<DepartmentMailMessage | null> {
    const current = await this.getInbox()
    const index = current.messages.findIndex((m) => m.id === id)
    if (index < 0) return null
    const next = { ...current.messages[index], ...patch }
    const messages = [...current.messages]
    messages[index] = next
    await this.write({ messages, updated_at: 0 })
    return next
  }

  getPendingMessages(): DepartmentMailMessage[] {
    return this.cache.messages.filter((m) => m.status === 'pending')
  }
}
