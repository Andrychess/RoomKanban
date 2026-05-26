import type { RoomSyncEvent, RoomSyncSource } from '../../shared/syncEvents'
import { broadcastRoomSync } from './syncBroadcast'
import { chokidarWriteFinish } from './syncPath'

export class ExternalSyncHelper {
  private suppressWatchUntil = 0

  constructor(
    private roomPath: string,
    private source: RoomSyncSource
  ) {}

  writeFinishOptions(): ReturnType<typeof chokidarWriteFinish> {
    return chokidarWriteFinish(this.roomPath)
  }

  markOwnWrite(): void {
    this.suppressWatchUntil = Date.now() + 600
  }

  shouldIgnoreWatch(): boolean {
    return Date.now() < this.suppressWatchUntil
  }

  notifyExternal(manual: boolean, extra?: Pick<RoomSyncEvent, 'merged'>): void {
    const event: RoomSyncEvent = { source: this.source, manual, ...extra }
    broadcastRoomSync(event)
  }
}
