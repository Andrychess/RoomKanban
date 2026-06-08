import { isDoneStatus } from './taskStatus'
import type { Task } from './types'

/** YYYY-MM-DD в локальной зоне */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIso(): string {
  return toIsoDateLocal(new Date())
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/

/** Календарная дата из срока (для группировки в календаре и напоминаний). */
export function dueDateOnly(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const m = value.match(DATE_TIME)
  if (m) return m[1]
  if (DATE_ONLY.test(value)) return value
  return null
}

export function splitDueDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value?.trim()) return { date: '', time: '' }
  const m = value.match(DATE_TIME)
  if (m) return { date: m[1], time: m[2] }
  if (DATE_ONLY.test(value)) return { date: value, time: '' }
  return { date: '', time: '' }
}

/** date — YYYY-MM-DD, time — HH:mm (пусто = только дата, конец дня для срока). */
export function mergeDueDateTime(date: string, time: string): string | null {
  const d = date.trim()
  if (!d) return null
  const t = time.trim()
  if (t) return `${d}T${t}`
  return d
}

/** Момент дедлайна: с временем — точное; только дата — конец дня 23:59:59. */
export function parseDueDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const m = value.match(DATE_TIME)
  if (m) {
    const [y, mo, day] = m[1].split('-').map(Number)
    const [h, min] = m[2].split(':').map(Number)
    return new Date(y, mo - 1, day, h, min, 0, 0)
  }
  if (DATE_ONLY.test(value)) {
    const [y, mo, day] = value.split('-').map(Number)
    return new Date(y, mo - 1, day, 23, 59, 59, 999)
  }
  return null
}

export function formatDueDate(value: string | null | undefined): string {
  const d = parseDueDate(value)
  if (!d || !value?.trim()) return '—'
  const dateStr = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  if (!value.includes('T')) {
    return `${dateStr} (до конца дня)`
  }
  const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr}, ${timeStr}`
}

/** Короткий формат для свёрнутой карточки на канбане. */
export function formatDueDateShort(value: string | null | undefined): string {
  const d = parseDueDate(value)
  if (!d || !value?.trim()) return '—'
  const day = d.getDate()
  const month = d.toLocaleDateString('ru-RU', { month: 'short' }).replace(/\.$/, '')
  if (!value.includes('T')) return `${day} ${month}`
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${month} · ${time}`
}

export function isOverdue(
  dueDate: string | null | undefined,
  status: Task['status'] | string
): boolean {
  if (!dueDate || isDoneStatus(status)) return false
  const d = parseDueDate(dueDate)
  if (!d) return false
  return d.getTime() < Date.now()
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const datePart = dueDateOnly(iso) ?? iso
  const d = new Date(datePart + 'T12:00:00')
  d.setDate(d.getDate() + deltaDays)
  return toIsoDateLocal(d)
}

export function daysOverdue(
  dueDate: string,
  status?: Task['status'] | string
): number {
  if (status != null && isDoneStatus(status)) return 0
  const d = parseDueDate(dueDate)
  if (!d) return 0
  if (d.getTime() >= Date.now()) return 0
  const ms = Date.now() - d.getTime()
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/** Нормализация при сохранении в JSON. */
export function normalizeDueDateStorage(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const { date, time } = splitDueDateTime(value.trim())
  if (!date || !DATE_ONLY.test(date)) return null
  return time ? `${date}T${time}` : date
}
