import fs from 'fs/promises'
import path from 'path'
import {
  DEFAULT_DEPARTMENT_MAIL_SETTINGS,
  type DepartmentMailSettings
} from '../../shared/departmentMail'

export class DepartmentMailSettingsStore {
  private settingsPath: string
  private cache: DepartmentMailSettings = DEFAULT_DEPARTMENT_MAIL_SETTINGS

  constructor(private roomPath: string) {
    this.settingsPath = path.join(roomPath, 'sync', 'department_mail_settings.json')
  }

  async ensureDefaults(): Promise<void> {
    try {
      await fs.access(this.settingsPath)
    } catch {
      await this.write(DEFAULT_DEPARTMENT_MAIL_SETTINGS)
    }
  }

  private async read(): Promise<DepartmentMailSettings> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8')
      const data = JSON.parse(raw) as Partial<DepartmentMailSettings>
      const port = typeof data.port === 'number' && data.port > 0 ? data.port : 993
      return {
        enabled: Boolean(data.enabled),
        host: typeof data.host === 'string' ? data.host.trim() : '',
        port,
        secure: data.secure !== false,
        user: typeof data.user === 'string' ? data.user.trim() : '',
        updated_at: data.updated_at ?? 0
      }
    } catch {
      return { ...DEFAULT_DEPARTMENT_MAIL_SETTINGS }
    }
  }

  private async write(settings: DepartmentMailSettings): Promise<void> {
    const next = { ...settings, updated_at: Math.floor(Date.now() / 1000) }
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
    await fs.writeFile(this.settingsPath, JSON.stringify(next, null, 2), 'utf-8')
    this.cache = next
  }

  async getSettings(): Promise<DepartmentMailSettings> {
    this.cache = await this.read()
    return this.cache
  }

  async saveSettings(settings: DepartmentMailSettings): Promise<DepartmentMailSettings> {
    await this.write(settings)
    return this.cache
  }
}
