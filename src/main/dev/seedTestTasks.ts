import { DEFAULT_PRIORITY_ID } from '../../shared/defaultTaskPriorities'
import { SEED_TEST_TASK_DRAFTS } from '../../shared/seedTestTasks'
import type { Room } from '../../shared/types'
import type { BoardSyncManager } from '../sync/BoardSyncManager'

export async function seedTestTasks(boardSync: BoardSyncManager, room: Room): Promise<number> {
  const assignees = Object.keys(room.state.employees)
  const pcIds = assignees.length > 0 ? assignees : [room.pcId]

  for (let i = 0; i < SEED_TEST_TASK_DRAFTS.length; i++) {
    const draft = SEED_TEST_TASK_DRAFTS[i]
    await boardSync.createTask({
      title: draft.title,
      description: draft.description,
      assignee_pc: pcIds[i % pcIds.length],
      type_id: draft.type_id,
      priority_id: DEFAULT_PRIORITY_ID,
      due_date: draft.due_date ?? null,
      status: draft.status
    })
  }

  return SEED_TEST_TASK_DRAFTS.length
}
