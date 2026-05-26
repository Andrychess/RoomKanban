import fs from 'fs/promises'
import path from 'path'
import type { RoomListItem, RoomState, RoomsSyncSummary } from '../../shared/types'
import { getRoomTaskStats } from '../sync/roomTaskStats'
import { SettingsStore } from '../settings/SettingsStore'

async function inspectRoom(
  folderPath: string,
  currentPath: string | null
): Promise<RoomListItem> {
  const normalized = path.normalize(folderPath)
  const base: RoomListItem = {
    path: normalized,
    room_name: null,
    invite_code: null,
    created_at: null,
    last_sync_at: null,
    task_count: 0,
    employee_count: 0,
    status: 'not_found',
    is_current: currentPath !== null && path.normalize(currentPath) === normalized
  }

  try {
    await fs.access(normalized)
  } catch {
    return { ...base, status: 'unavailable' }
  }

  const roomStatePath = path.join(normalized, 'sync', 'room_state.json')
  try {
    const raw = await fs.readFile(roomStatePath, 'utf-8')
    const state = JSON.parse(raw) as RoomState

    const { task_count, last_sync_at } = await getRoomTaskStats(normalized)

    return {
      path: normalized,
      room_name: state.room_name,
      invite_code: state.invite_code,
      created_at: state.created_at,
      last_sync_at,
      task_count,
      employee_count: Object.keys(state.employees ?? {}).length,
      status: 'synced',
      is_current: base.is_current
    }
  } catch {
    return { ...base, status: 'invalid' }
  }
}

export async function listKnownRooms(settings: SettingsStore): Promise<RoomsSyncSummary> {
  await settings.load()
  const recent = settings.getRecentRooms()
  const current = settings.getCurrentRoomPath()

  const seen = new Set<string>()
  const paths: string[] = []
  for (const p of [current, ...recent]) {
    if (!p) continue
    const n = path.normalize(p)
    if (seen.has(n)) continue
    seen.add(n)
    paths.push(n)
  }

  const rooms = await Promise.all(paths.map((p) => inspectRoom(p, current)))
  const available = rooms.filter((r) => r.status === 'synced')

  return {
    rooms,
    all_synced: rooms.length > 0 && rooms.every((r) => r.status === 'synced'),
    available_count: available.length,
    checked_at: Math.floor(Date.now() / 1000)
  }
}
