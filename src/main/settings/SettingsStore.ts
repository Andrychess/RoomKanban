import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { computeMachineFingerprint } from '../identity/machineFingerprint'
import { defaultColumnCollapsed } from '../../shared/kanbanColumnCollapse'
import type { AppSettings, AppTheme } from '../../shared/types'
import type { TaskStatus } from '../../shared/taskStatus'

const MAX_RECENT = 10

function defaultSettings(): AppSettings {
  return {
    theme: 'dark',
    currentRoomPath: null,
    lastOpenedRooms: [],
    machineFingerprint: computeMachineFingerprint(),
    employeeBindings: {}
  }
}

export class SettingsStore {
  private settingsPath: string
  private settings: AppSettings | null = null

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
  }

  async load(): Promise<AppSettings> {
    if (this.settings) return this.settings
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      this.settings = { ...defaultSettings(), ...parsed }
      if (!this.settings.machineFingerprint) {
        this.settings.machineFingerprint = computeMachineFingerprint()
      }
      if (!this.settings.employeeBindings) {
        this.settings.employeeBindings = {}
      }
      if (!this.settings.kanbanColumnCollapsed) {
        this.settings.kanbanColumnCollapsed = {}
      }
      await this.save()
    } catch {
      this.settings = defaultSettings()
      await this.save()
    }
    return this.settings!
  }

  private async save(): Promise<void> {
    if (!this.settings) return
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true })
    await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
  }

  async getTheme(): Promise<AppTheme> {
    const s = await this.load()
    return s.theme === 'light' ? 'light' : 'dark'
  }

  async setTheme(theme: AppTheme): Promise<AppTheme> {
    const s = await this.load()
    s.theme = theme === 'light' ? 'light' : 'dark'
    await this.save()
    return s.theme
  }

  async getMachineFingerprint(): Promise<string> {
    const s = await this.load()
    return s.machineFingerprint
  }

  /** @deprecated Используйте getMachineFingerprint; для старых комнат с ключом pc_* */
  async getLegacyPcId(): Promise<string | null> {
    const s = await this.load()
    return s.pcId ?? null
  }

  getEmployeeBinding(roomPath: string): string | null {
    const normalized = path.normalize(roomPath)
    return this.settings?.employeeBindings[normalized] ?? null
  }

  async setEmployeeBinding(roomPath: string, employeeKey: string): Promise<void> {
    const s = await this.load()
    s.employeeBindings[path.normalize(roomPath)] = employeeKey
    await this.save()
  }

  getCurrentRoomPath(): string | null {
    return this.settings?.currentRoomPath ?? null
  }

  async setCurrentRoomPath(roomPath: string): Promise<void> {
    const s = await this.load()
    s.currentRoomPath = roomPath
    await this.addToRecentRooms(roomPath)
    await this.save()
  }

  async clearCurrentRoom(): Promise<void> {
    const s = await this.load()
    s.currentRoomPath = null
    await this.save()
  }

  async addToRecentRooms(roomPath: string): Promise<void> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    s.lastOpenedRooms = [
      normalized,
      ...s.lastOpenedRooms.filter((p) => path.normalize(p) !== normalized)
    ].slice(0, MAX_RECENT)
    await this.save()
  }

  getRecentRooms(): string[] {
    return this.settings?.lastOpenedRooms ?? []
  }

  getAllColumnCollapsed(roomPath: string): Record<TaskStatus, boolean> {
    const base = defaultColumnCollapsed()
    const normalized = path.normalize(roomPath)
    const saved = this.settings?.kanbanColumnCollapsed?.[normalized]
    if (!saved) return base
    return { ...base, ...saved }
  }

  async setColumnCollapsed(
    roomPath: string,
    column: TaskStatus,
    collapsed: boolean
  ): Promise<void> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    if (!s.kanbanColumnCollapsed) s.kanbanColumnCollapsed = {}
    if (!s.kanbanColumnCollapsed[normalized]) {
      s.kanbanColumnCollapsed[normalized] = { ...defaultColumnCollapsed() }
    }
    s.kanbanColumnCollapsed[normalized]![column] = collapsed
    await this.save()
  }

  async wasReminderSent(roomPath: string, key: string): Promise<boolean> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    return Boolean(s.reminderSent?.[normalized]?.[key])
  }

  async markReminderSent(roomPath: string, key: string): Promise<void> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    if (!s.reminderSent) s.reminderSent = {}
    if (!s.reminderSent[normalized]) s.reminderSent[normalized] = {}
    s.reminderSent[normalized][key] = Math.floor(Date.now() / 1000)
    await this.save()
  }

  async hasDepartmentMailPassword(roomPath: string): Promise<boolean> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    const password = s.departmentMailPasswords?.[normalized]
    return typeof password === 'string' && password.length > 0
  }

  async getDepartmentMailPassword(roomPath: string): Promise<string | null> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    const password = s.departmentMailPasswords?.[normalized]
    return typeof password === 'string' && password.length > 0 ? password : null
  }

  async setDepartmentMailPassword(roomPath: string, password: string | null): Promise<void> {
    const s = await this.load()
    const normalized = path.normalize(roomPath)
    if (!s.departmentMailPasswords) s.departmentMailPasswords = {}
    if (password?.trim()) {
      s.departmentMailPasswords[normalized] = password
    } else {
      delete s.departmentMailPasswords[normalized]
    }
    await this.save()
  }
}
