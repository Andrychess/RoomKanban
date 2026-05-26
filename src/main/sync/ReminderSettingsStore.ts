import fs from 'fs/promises'
import path from 'path'
import type { ReminderSettings } from '../../shared/types'

const DEFAULT_SETTINGS: ReminderSettings = {
  days_before: [1, 3],
  notify_assignee: true,
  notify_chief: true,
  updated_at: 0
}

export class ReminderSettingsStore {
  private settingsPath: string
  private cache: ReminderSettings = DEFAULT_SETTINGS

  constructor(private roomPath: string) {
    this.settingsPath = path.join(roomPath, 'sync', 'reminder_settings.json')
  }

  async ensureDefaults(): Promise<void> {
    try {
      await fs.access(this.settingsPath)
    } catch {
      await this.write(DEFAULT_SETTINGS)
    }
  }

  private async read(): Promise<ReminderSettings> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8')
      const data = JSON.parse(raw) as ReminderSettings
      return {
        days_before: Array.isArray(data.days_before) ? data.days_before : [1, 3],
        notify_assignee: data.notify_assignee !== false,
        notify_chief: data.notify_chief !== false,
        updated_at: data.updated_at ?? 0
      }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  private async write(settings: ReminderSettings): Promise<void> {
    const next = { ...settings, updated_at: Math.floor(Date.now() / 1000) }
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
    await fs.writeFile(this.settingsPath, JSON.stringify(next, null, 2), 'utf-8')
    this.cache = next
  }

  async getSettings(): Promise<ReminderSettings> {
    this.cache = await this.read()
    return this.cache
  }

  async saveSettings(settings: ReminderSettings): Promise<ReminderSettings> {
    await this.write(settings)
    return this.cache
  }
}
