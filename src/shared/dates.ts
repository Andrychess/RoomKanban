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

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'done') return false
  return dueDate < todayIso()
}

export function addDaysIso(iso: string, deltaDays: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + deltaDays)
  return toIsoDateLocal(d)
}

export function daysOverdue(dueDate: string): number {
  const today = todayIso()
  if (dueDate >= today) return 0
  const due = new Date(dueDate + 'T12:00:00')
  const now = new Date(today + 'T12:00:00')
  const ms = now.getTime() - due.getTime()
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}
