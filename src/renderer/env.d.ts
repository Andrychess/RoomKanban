import type { RoomKanbanApi } from '../preload/index'

declare global {
  interface Window {
    api: RoomKanbanApi
  }
}

export {}
