import { todayISO } from './taskDates'

export const REPEATS = [
  { value: '', label: "Doesn't repeat" },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export const REPEAT_LABEL = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// The next due date after completing a repeating task. Counts forward from
// the task's own due date so a late tick-off doesn't shift the schedule —
// but never lands in the past, so finishing a month late doesn't create a
// backlog of missed copies.
export function nextDueDate(task) {
  if (!task.repeat_every) return null

  const interval = Math.max(1, Number(task.repeat_interval) || 1)
  const today = todayISO()
  const base = task.due_date || today

  let cursor = new Date(`${base}T12:00:00`)
  let guard = 0

  do {
    if (task.repeat_every === 'daily') cursor.setDate(cursor.getDate() + interval)
    if (task.repeat_every === 'weekly') cursor.setDate(cursor.getDate() + interval * 7)
    if (task.repeat_every === 'monthly') cursor.setMonth(cursor.getMonth() + interval)
    if (task.repeat_every === 'yearly') cursor.setFullYear(cursor.getFullYear() + interval)
    guard += 1
  } while (toISO(cursor) <= today && guard < 500)

  return toISO(cursor)
}

// The fresh copy to insert when a repeating task is completed.
export function nextOccurrence(task) {
  const due = nextDueDate(task)
  if (!due) return null

  return {
    title: task.title,
    notes: task.notes,
    project_id: task.project_id,
    priority: task.priority,
    status: 'todo',
    due_date: due,
    repeat_every: task.repeat_every,
    repeat_interval: task.repeat_interval,
    sort_order: task.sort_order,
  }
}

export const REPEAT_UNIT = {
  daily: 'days',
  weekly: 'weeks',
  monthly: 'months',
  yearly: 'years',
}
