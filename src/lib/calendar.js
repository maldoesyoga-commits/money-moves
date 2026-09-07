// Month grid helpers — Monday-start weeks, padded to full weeks so the
// calendar is always a clean 6x7 (or 5x7) block.

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthGrid(anchor) {
  const base = new Date(`${anchor}T12:00:00`)
  const year = base.getFullYear()
  const month = base.getMonth()

  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7

  const start = new Date(year, month, 1 - lead)
  const last = new Date(year, month + 1, 0)
  const trail = 6 - ((last.getDay() + 6) % 7)
  const total = lead + last.getDate() + trail

  const days = []
  for (let i = 0; i < total; i += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push({ iso: toISO(day), inMonth: day.getMonth() === month, dayOfMonth: day.getDate() })
  }

  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return weeks
}

export function shiftMonth(anchor, delta) {
  const base = new Date(`${anchor}T12:00:00`)
  return toISO(new Date(base.getFullYear(), base.getMonth() + delta, 1))
}

export function monthLabel(anchor) {
  return new Date(`${anchor}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ISO-8601 week number: weeks start Monday, week 1 contains the first
// Thursday of the year. This is the "week 37 of 52" people mean.
export function isoWeek(iso) {
  const date = new Date(`${iso}T12:00:00`)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  // Shift to the Thursday of this week.
  const day = (target.getDay() + 6) % 7
  target.setDate(target.getDate() - day + 3)

  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3)

  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000))
  return { week, year: target.getFullYear() }
}

// 52 or 53, depending on the year.
export function weeksInYear(year) {
  const dec28 = `${year}-12-28`
  return isoWeek(dec28).week
}
