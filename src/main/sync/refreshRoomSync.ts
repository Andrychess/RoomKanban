import { broadcastRoomSync } from './syncBroadcast'
import type { BoardSyncManager } from './BoardSyncManager'
import type { ExchangeStore } from './ExchangeStore'
import type { TaskPrioritiesStore } from './TaskPrioritiesStore'
import type { TaskTemplatesStore } from './TaskTemplatesStore'
import type { TaskTypesStore } from './TaskTypesStore'

export async function refreshRoomSync(stores: {
  boardSync: BoardSyncManager | null
  exchangeStore: ExchangeStore | null
  taskTypesStore: TaskTypesStore | null
  taskPrioritiesStore: TaskPrioritiesStore | null
  taskTemplatesStore: TaskTemplatesStore | null
}): Promise<{ refreshed_at: number }> {
  const jobs: Promise<void>[] = []
  if (stores.boardSync) jobs.push(stores.boardSync.reload())
  if (stores.exchangeStore) jobs.push(stores.exchangeStore.reload())
  if (stores.taskTypesStore) jobs.push(stores.taskTypesStore.reload())
  if (stores.taskPrioritiesStore) jobs.push(stores.taskPrioritiesStore.reload())
  if (stores.taskTemplatesStore) jobs.push(stores.taskTemplatesStore.reload())
  await Promise.all(jobs)
  broadcastRoomSync({ source: 'all', manual: true })
  return { refreshed_at: Date.now() }
}
