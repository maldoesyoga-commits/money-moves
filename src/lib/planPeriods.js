import { todayISO } from './taskDates'

export const HORIZONS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
]

function toDate(iso) {
  return new Date(`${iso}T12:00:00`)
}

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(iso, days) {
  const date = toDate(iso)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

// Monday-start weeks.
function startOfWeek(iso) {
  const date = toDate(iso)
  const weekday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - weekday)
  return toISO(date)
}

export function periodRange(horizon, anchor) {
  const date = toDate(anchor)
  const year = date.getFullYear()
  const month = date.getMonth()

  if (horizon === 'day') {
    return { start: anchor, end: anchor }
  }

  if (horizon === 'week') {
    const start = startOfWeek(anchor)
    return { start, end: addDays(start, 6) }
  }

  if (horizon === 'month') {
    return { start: toISO(new Date(year, month, 1)), end: toISO(new Date(year, month + 1, 0)) }
  }

  if (horizon === 'quarter') {
    const firstMonth = Math.floor(month / 3) * 3
    return {
      start: toISO(new Date(year, firstMonth, 1)),
      end: toISO(new Date(year, firstMonth + 3, 0)),
    }
  }

  return { start: toISO(new Date(year, 0, 1)), end: toISO(new Date(year, 11, 31)) }
}

export function shiftPeriod(horizon, anchor, delta) {
  const date = toDate(anchor)

  if (horizon === 'day') return addDays(anchor, delta)
  if (horizon === 'week') return addDays(startOfWeek(anchor), delta * 7)
  if (horizon === 'month') return toISO(new Date(date.getFullYear(), date.getMonth() + delta, 1))
  if (horizon === 'quarter') {
    const firstMonth = Math.floor(date.getMonth() / 3) * 3
    return toISO(new Date(date.getFullYear(), firstMonth + delta * 3, 1))
  }

  return toISO(new Date(date.getFullYear() + delta, 0, 1))
}

export function periodLabel(horizon, anchor) {
  const { start, end } = periodRange(horizon, anchor)
  const startDate = toDate(start)

  if (horizon === 'day') {
    return startDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  if (horizon === 'week') {
    const endDate = toDate(end)
    const sameMonth = startDate.getMonth() === endDate.getMonth()
    const startText = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const endText = endDate.toLocaleDateString(
      undefined,
      sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' },
    )
    return `${startText} – ${endText}`
  }

  if (horizon === 'month') {
    return startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  if (horizon === 'quarter') {
    return `Q${Math.floor(startDate.getMonth() / 3) + 1} ${startDate.getFullYear()}`
  }

  return String(startDate.getFullYear())
}

export function isCurrentPeriod(horizon, anchor) {
  const { start, end } = periodRange(horizon, anchor)
  const today = todayISO()
  return today >= start && today <= end
}

export function daysInRange(start, end) {
  const days = []
  let cursor = start
  while (cursor <= end) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
