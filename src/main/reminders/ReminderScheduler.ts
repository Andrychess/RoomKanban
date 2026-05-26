import { Notification } from 'electron'
import { addDaysIso, todayIso } from '../../shared/dates'
import type { Room, Task } from '../../shared/types'
import { isActiveTask } from '../../shared/tasks'
import type { BoardSyncManager } from '../sync/BoardSyncManager'
import type { ReminderSettingsStore } from '../sync/ReminderSettingsStore'
import type { SettingsStore } from '../settings/SettingsStore'

type RoomContext = () => Room | null

export class ReminderScheduler {
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(
    private getRoom: RoomContext,
    private getBoard: () => BoardSyncManager | null,
    private getReminderSettings: () => ReminderSettingsStore | null,
    private settings: SettingsStore
  ) {}

  start(): void {
    this.stop()
    void this.tick()
    this.interval = setInterval(() => void this.tick(), 5 * 60 * 1000)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private reminderKey(taskId: string, dueDate: string, kind: string): string {
    return `${taskId}:${dueDate}:${kind}`
  }

  private wasSent(roomPath: string, key: string): Promise<boolean> {
    return this.settings.wasReminderSent(roomPath, key)
  }

  private markSent(roomPath: string, key: string): Promise<void> {
    return this.settings.markReminderSent(roomPath, key)
  }

  private notify(title: string, body: string): void {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body })
    n.show()
  }

  private async tick(): Promise<void> {
    const room = this.getRoom()
    const board = this.getBoard()
    const reminderStore = this.getReminderSettings()
    if (!room || !board || !reminderStore) return

    const settings = await reminderStore.getSettings()
    const tasks = (await board.getTasks()).filter(isActiveTask)
    const today = todayIso()
    const roomPath = room.path
    for (const task of tasks) {
      if (!task.due_date || task.status === 'done') continue

      const assignee = room.state.employees[task.assignee_pc]
      const assigneeName = assignee?.name ?? 'Сотрудник'

      if (task.due_date === today) {
        const key = this.reminderKey(task.id, task.due_date, 'due_today')
        if (!(await this.wasSent(roomPath, key))) {
          if (settings.notify_assignee && task.assignee_pc === room.pcId) {
            this.notify('Срок сегодня', `${task.title}`)
          }
          if (settings.notify_chief && room.isChief) {
            this.notify('Срок сегодня', `${task.title} — ${assigneeName}`)
          }
          if (settings.notify_assignee && task.assignee_pc !== room.pcId) {
            /* другой ПК получит при своём тике */
          }
          await this.markSent(roomPath, key)
        }
      }

      for (const days of settings.days_before) {
        if (days <= 0) continue
        const remindOn = addDaysIso(task.due_date, -days)
        if (remindOn !== today) continue
        const key = this.reminderKey(task.id, task.due_date, `before_${days}`)
        if (await this.wasSent(roomPath, key)) continue

        const msg = `${task.title} — через ${days} дн. (${task.due_date})`
        if (settings.notify_assignee && task.assignee_pc === room.pcId) {
          this.notify('Приближается срок', msg)
        }
        if (settings.notify_chief && room.isChief) {
          this.notify('Приближается срок', `${msg} · ${assigneeName}`)
        }
        await this.markSent(roomPath, key)
      }
    }
  }
}
