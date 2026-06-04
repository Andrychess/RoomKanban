import { BrowserWindow } from 'electron'
import type { RoomSyncEvent } from '../../shared/syncEvents'

export function broadcastRoomSync(event: RoomSyncEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('room-sync-updated', event)
    }
  }
}

/** После ручного «Обновить синхронизацию» — перечитать справочники и обмен в UI. */
export function broadcastRoomDataRefresh(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('room-data-refreshed')
    }
  }
}
