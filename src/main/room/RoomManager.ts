import fs from 'fs/promises'
import path from 'path'
import type {
  Employee,
  EmployeeProfile,
  EnterRoomCredentials,
  Room,
  RoomEntryInfo,
  RoomState,
  PcSyncData
} from '../../shared/types'
import {
  hashPassword,
  hasPasswordSecret,
  verifyPassword
} from '../security/passwordHash'
import { generateInviteCode } from './inviteCode'
import { SettingsStore } from '../settings/SettingsStore'
import { TaskPrioritiesStore } from '../sync/TaskPrioritiesStore'
import { TaskTypesStore } from '../sync/TaskTypesStore'
import { TaskTemplatesStore } from '../sync/TaskTemplatesStore'

export class RoomError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'NOT_EMPTY'
      | 'ALREADY_EXISTS'
      | 'INVALID'
      | 'NOT_MEMBER'
      | 'CHIEF'
      | 'IN_USE'
      | 'WRONG_PASSWORD'
  ) {
    super(message)
    this.name = 'RoomError'
  }
}

function newEmployeeKey(): string {
  return `emp_${Math.random().toString(36).slice(2, 11)}`
}

function toProfiles(state: RoomState): EmployeeProfile[] {
  return Object.entries(state.employees)
    .map(([key, emp]) => ({
      key,
      name: emp.name,
      role: emp.role,
      isChief: key === state.chief_pc,
      hasPassword: hasPasswordSecret(emp.password)
    }))
    .sort((a, b) => {
      if (a.isChief !== b.isChief) return a.isChief ? -1 : 1
      return a.name.localeCompare(b.name, 'ru')
    })
}

export class RoomManager {
  private currentRoom: Room | null = null

  constructor(private settings: SettingsStore) {}

  getCurrentRoom(): Room | null {
    return this.currentRoom
  }

  setCurrentRoom(room: Room | null): void {
    this.currentRoom = room
  }

  private refreshCurrentRoomState(state: RoomState): Room {
    if (!this.currentRoom) {
      throw new RoomError('Комната не открыта', 'INVALID')
    }
    const room = this.buildRoom(this.currentRoom.path, state, this.currentRoom.pcId)
    this.currentRoom = room
    return room
  }

  async isRoomFolder(folderPath: string): Promise<boolean> {
    const roomStatePath = path.join(folderPath, 'sync', 'room_state.json')
    try {
      await fs.access(roomStatePath)
      return true
    } catch {
      return false
    }
  }

  private async ensureRoomStructure(folderPath: string): Promise<void> {
    await fs.mkdir(folderPath, { recursive: true })
    await fs.mkdir(path.join(folderPath, 'docs'), { recursive: true })
    await fs.mkdir(path.join(folderPath, 'sync'), { recursive: true })
    await fs.mkdir(path.join(folderPath, '.room'), { recursive: true })
  }

  private async isFolderEmptyOrNew(folderPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(folderPath)
      const visible = entries.filter((e) => e !== '.' && e !== '..')
      return visible.length === 0
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return true
      throw err
    }
  }

  private async readRoomState(folderPath: string): Promise<RoomState> {
    const roomStatePath = path.join(folderPath, 'sync', 'room_state.json')
    try {
      const raw = await fs.readFile(roomStatePath, 'utf-8')
      return JSON.parse(raw) as RoomState
    } catch {
      throw new RoomError('Комната не найдена', 'NOT_FOUND')
    }
  }

  private async writeRoomState(folderPath: string, state: RoomState): Promise<void> {
    const roomStatePath = path.join(folderPath, 'sync', 'room_state.json')
    await fs.writeFile(roomStatePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  private async createPcSyncFile(folderPath: string, employeeKey: string): Promise<void> {
    const data: PcSyncData = {
      pc_id: employeeKey,
      tasks: [],
      updated_at: Math.floor(Date.now() / 1000)
    }
    const pcPath = path.join(folderPath, 'sync', `${employeeKey}.json`)
    await fs.writeFile(pcPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  private buildRoom(folderPath: string, state: RoomState, employeeKey: string): Room {
    return {
      path: folderPath,
      state,
      pcId: employeeKey,
      isChief: state.chief_pc === employeeKey
    }
  }

  async resolveRoomEntry(folderPath: string): Promise<RoomEntryInfo> {
    const normalized = path.normalize(folderPath)
    if (!(await this.isRoomFolder(normalized))) {
      throw new RoomError('Комната не найдена', 'NOT_FOUND')
    }

    const state = await this.readRoomState(normalized)
    const lastUsedEmployeeKey = this.settings.getEmployeeBinding(normalized)

    return {
      folderPath: normalized,
      roomName: state.room_name,
      inviteCode: state.invite_code,
      createdAt: state.created_at,
      employees: toProfiles(state),
      lastUsedEmployeeKey:
        lastUsedEmployeeKey && state.employees[lastUsedEmployeeKey] ? lastUsedEmployeeKey : null,
      requiresRoomPassword: hasPasswordSecret(state.room_password)
    }
  }

  async verifyRoomPassword(folderPath: string, password: string): Promise<boolean> {
    const normalized = path.normalize(folderPath)
    const state = await this.readRoomState(normalized)
    if (!hasPasswordSecret(state.room_password)) return true
    return verifyPassword(password, state.room_password!)
  }

  private async assertRoomPassword(state: RoomState, password?: string): Promise<void> {
    if (!hasPasswordSecret(state.room_password)) return
    if (!password || !(await verifyPassword(password, state.room_password!))) {
      throw new RoomError('Неверный пароль комнаты', 'WRONG_PASSWORD')
    }
  }

  private async assertEmployeePassword(emp: Employee, password?: string): Promise<void> {
    if (!hasPasswordSecret(emp.password)) return
    if (!password || !(await verifyPassword(password, emp.password!))) {
      throw new RoomError('Неверный пароль учётной записи', 'WRONG_PASSWORD')
    }
  }

  async enterRoom(
    folderPath: string,
    employeeKey: string,
    credentials: EnterRoomCredentials = {}
  ): Promise<Room> {
    const normalized = path.normalize(folderPath)
    const state = await this.readRoomState(normalized)

    if (!state.employees[employeeKey]) {
      throw new RoomError('Сотрудник не найден в комнате', 'NOT_MEMBER')
    }

    await this.assertRoomPassword(state, credentials.roomPassword)
    await this.assertEmployeePassword(state.employees[employeeKey], credentials.employeePassword)

    const pcPath = path.join(normalized, 'sync', `${employeeKey}.json`)
    try {
      await fs.access(pcPath)
    } catch {
      await this.createPcSyncFile(normalized, employeeKey)
    }

    await this.settings.setEmployeeBinding(normalized, employeeKey)

    const room = this.buildRoom(normalized, state, employeeKey)
    this.currentRoom = room
    await this.settings.setCurrentRoomPath(normalized)
    return room
  }

  async createRoom(
    folderPath: string,
    roomName: string,
    userName: string,
    userRole: string,
    options?: { roomPassword?: string; chiefPassword?: string }
  ): Promise<Room> {
    const normalized = path.normalize(folderPath)

    if (await this.isRoomFolder(normalized)) {
      throw new RoomError('В этой папке уже есть комната', 'ALREADY_EXISTS')
    }

    const empty = await this.isFolderEmptyOrNew(normalized)
    if (!empty) {
      throw new RoomError(
        'Папка не пуста. Выберите пустую папку или создайте новую.',
        'NOT_EMPTY'
      )
    }

    await this.ensureRoomStructure(normalized)

    const employeeKey = newEmployeeKey()
    const now = Math.floor(Date.now() / 1000)
    const inviteCode = generateInviteCode()

    const chiefEmployee: Employee = {
      name: userName.trim(),
      role: userRole.trim(),
      joined_at: now
    }
    if (options?.chiefPassword?.trim()) {
      chiefEmployee.password = await hashPassword(options.chiefPassword.trim())
    }

    const state: RoomState = {
      room_id: inviteCode,
      room_name: roomName.trim(),
      invite_code: inviteCode,
      created_at: now,
      chief_pc: employeeKey,
      employees: {
        [employeeKey]: chiefEmployee
      }
    }
    if (options?.roomPassword?.trim()) {
      state.room_password = await hashPassword(options.roomPassword.trim())
    }

    await this.writeRoomState(normalized, state)
    await this.createPcSyncFile(normalized, employeeKey)
    await TaskTypesStore.createInitialFile(normalized)
    await TaskPrioritiesStore.createInitialFile(normalized)
    await TaskTemplatesStore.createInitialFile(normalized)

    await this.settings.setEmployeeBinding(normalized, employeeKey)

    const room = this.buildRoom(normalized, state, employeeKey)
    this.currentRoom = room
    await this.settings.setCurrentRoomPath(normalized)
    return room
  }

  async addEmployee(name: string, role: string): Promise<Room> {
    if (!this.currentRoom) throw new RoomError('Комната не открыта', 'INVALID')
    if (!this.currentRoom.isChief) {
      throw new RoomError('Только начальник может добавлять сотрудников', 'INVALID')
    }

    const normalized = this.currentRoom.path
    const state = await this.readRoomState(normalized)
    const trimmedName = name.trim()
    const trimmedRole = role.trim()
    if (!trimmedName || !trimmedRole) {
      throw new RoomError('Укажите имя и роль', 'INVALID')
    }

    let key = newEmployeeKey()
    while (state.employees[key]) {
      key = newEmployeeKey()
    }

    const now = Math.floor(Date.now() / 1000)
    state.employees[key] = {
      name: trimmedName,
      role: trimmedRole,
      joined_at: now
    }
    await this.writeRoomState(normalized, state)
    await this.createPcSyncFile(normalized, key)
    return this.refreshCurrentRoomState(state)
  }

  async updateEmployee(employeeKey: string, name: string, role: string): Promise<Room> {
    if (!this.currentRoom) throw new RoomError('Комната не открыта', 'INVALID')
    if (!this.currentRoom.isChief) {
      throw new RoomError('Только начальник может изменять состав', 'INVALID')
    }

    const normalized = this.currentRoom.path
    const state = await this.readRoomState(normalized)
    if (!state.employees[employeeKey]) {
      throw new RoomError('Сотрудник не найден', 'NOT_MEMBER')
    }

    const trimmedName = name.trim()
    const trimmedRole = role.trim()
    if (!trimmedName || !trimmedRole) {
      throw new RoomError('Укажите имя и роль', 'INVALID')
    }

    state.employees[employeeKey].name = trimmedName
    state.employees[employeeKey].role = trimmedRole
    await this.writeRoomState(normalized, state)
    return this.refreshCurrentRoomState(state)
  }

  async removeEmployee(employeeKey: string): Promise<Room> {
    if (!this.currentRoom) throw new RoomError('Комната не открыта', 'INVALID')
    if (!this.currentRoom.isChief) {
      throw new RoomError('Только начальник может удалять сотрудников', 'INVALID')
    }

    const normalized = this.currentRoom.path
    const state = await this.readRoomState(normalized)

    if (!state.employees[employeeKey]) {
      throw new RoomError('Сотрудник не найден', 'NOT_MEMBER')
    }
    if (employeeKey === state.chief_pc) {
      throw new RoomError('Нельзя удалить начальника комнаты', 'CHIEF')
    }

    delete state.employees[employeeKey]
    await this.writeRoomState(normalized, state)

    const pcPath = path.join(normalized, 'sync', `${employeeKey}.json`)
    try {
      await fs.unlink(pcPath)
    } catch {
      /* already gone */
    }

    return this.refreshCurrentRoomState(state)
  }

  async setRoomPassword(password: string | null): Promise<Room> {
    if (!this.currentRoom) throw new RoomError('Комната не открыта', 'INVALID')
    if (!this.currentRoom.isChief) {
      throw new RoomError('Только начальник может менять пароль комнаты', 'INVALID')
    }

    const normalized = this.currentRoom.path
    const state = await this.readRoomState(normalized)
    if (password?.trim()) {
      state.room_password = await hashPassword(password.trim())
    } else {
      delete state.room_password
    }
    await this.writeRoomState(normalized, state)
    return this.refreshCurrentRoomState(state)
  }

  async setEmployeePassword(employeeKey: string, password: string | null): Promise<Room> {
    if (!this.currentRoom) throw new RoomError('Комната не открыта', 'INVALID')
    if (!this.currentRoom.isChief) {
      throw new RoomError('Только начальник может менять пароли сотрудников', 'INVALID')
    }

    const normalized = this.currentRoom.path
    const state = await this.readRoomState(normalized)
    if (!state.employees[employeeKey]) {
      throw new RoomError('Сотрудник не найден', 'NOT_MEMBER')
    }

    if (password?.trim()) {
      state.employees[employeeKey].password = await hashPassword(password.trim())
    } else {
      delete state.employees[employeeKey].password
    }
    await this.writeRoomState(normalized, state)
    return this.refreshCurrentRoomState(state)
  }

  async peekRoom(folderPath: string): Promise<RoomState> {
    const normalized = path.normalize(folderPath)
    if (!(await this.isRoomFolder(normalized))) {
      throw new RoomError('Комната не найдена', 'NOT_FOUND')
    }
    return this.readRoomState(normalized)
  }

  async closeRoom(): Promise<void> {
    this.currentRoom = null
    await this.settings.clearCurrentRoom()
  }

  async tryAutoOpen(): Promise<Room | null> {
    const roomPath = this.settings.getCurrentRoomPath()
    if (!roomPath) return null

    try {
      const binding = this.settings.getEmployeeBinding(roomPath)
      if (!binding) return null

      const state = await this.readRoomState(roomPath)
      if (!state.employees[binding]) {
        return null
      }
      if (hasPasswordSecret(state.room_password)) return null
      if (hasPasswordSecret(state.employees[binding].password)) return null
      return await this.enterRoom(roomPath, binding)
    } catch {
      await this.settings.clearCurrentRoom()
      return null
    }
  }
}
