import { broadcastRoomDataRefresh, broadcastRoomSync } from './syncBroadcast'
import type { BoardSyncManager } from './BoardSyncManager'
import type { ExchangeStore } from './ExchangeStore'
import type { NotesStore } from './NotesStore'
import type { TaskPrioritiesStore } from './TaskPrioritiesStore'
import type { TaskTemplatesStore } from './TaskTemplatesStore'
import type { TaskTypesStore } from './TaskTypesStore'

export async function refreshRoomSync(stores: {
  boardSync: BoardSyncManager | null
  exchangeStore: ExchangeStore | null
  notesStore: NotesStore | null
  taskTypesStore: TaskTypesStore | null
  taskPrioritiesStore: TaskPrioritiesStore | null
  taskTemplatesStore: TaskTemplatesStore | null
}): Promise<{ refreshed_at: number }> {
  const jobs: Promise<void>[] = []
  if (stores.boardSync) jobs.push(stores.boardSync.reload())
  if (stores.exchangeStore) jobs.push(stores.exchangeStore.reload())
  if (stores.notesStore) jobs.push(stores.notesStore.reload())
  if (stores.taskTypesStore) jobs.push(stores.taskTypesStore.reload())
  if (stores.taskPrioritiesStore) jobs.push(stores.taskPrioritiesStore.reload())
  if (stores.taskTemplatesStore) jobs.push(stores.taskTemplatesStore.reload())

  const results = await Promise.allSettled(jobs)
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    const reason = failed[0].status === 'rejected' ? failed[0].reason : null
    throw reason instanceof Error ? reason : new Error('Не удалось обновить часть данных комнаты')
  }

  broadcastRoomSync({ source: 'all', manual: true })
  broadcastRoomDataRefresh()
  return { refreshed_at: Date.now() }
}
