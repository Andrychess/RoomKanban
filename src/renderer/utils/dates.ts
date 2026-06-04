export {
  addDaysIso,
  daysOverdue,
  dueDateOnly,
  formatDueDate,
  isOverdue,
  mergeDueDateTime,
  splitDueDateTime,
  todayIso,
  toIsoDateLocal
} from '../../shared/dates'

import { toIsoDateLocal } from '../../shared/dates'

export interface CalendarCell {
  iso: string | null
  day: number | null
  isCurrentMonth: boolean
  isToday: boolean
}

/** Понедельник — первый день недели */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = (first.getDay() + 6) % 7
  const cells: CalendarCell[] = []
  const today = toIsoDateLocal(new Date())

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i))
    const iso = toIsoDateLocal(d)
    cells.push({
      iso,
      day: d.getDate(),
      isCurrentMonth: false,
      isToday: iso === today
    })
  }

  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, month, day)
    const iso = toIsoDateLocal(d)
    cells.push({
      iso,
      day,
      isCurrentMonth: true,
      isToday: iso === today
    })
  }

  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - startPad - last.getDate() + 1
    const d = new Date(year, month + 1, nextIndex)
    const iso = toIsoDateLocal(d)
    cells.push({
      iso,
      day: d.getDate(),
      isCurrentMonth: false,
      isToday: iso === today
    })
  }

  return cells
}

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
]
