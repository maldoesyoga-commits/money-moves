import { todayISO } from './taskDates'

export const INTERVAL_UNITS = [
  { value: 'days', label: 'days' },
  { value: 'weeks', label: 'weeks' },
  { value: 'months', label: 'months' },
  { value: 'years', label: 'years' },
]

export const DOC_KINDS = [
  { value: 'manual', label: 'Manual' },
  { value: 'instructions', label: 'Instructions' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addInterval(iso, value, unit) {
  const date = new Date(`${iso}T12:00:00`)
  const amount = Math.max(1, Number(value) || 1)

  if (unit === 'days') date.setDate(date.getDate() + amount)
  if (unit === 'weeks') date.setDate(date.getDate() + amount * 7)
  if (unit === 'months') date.setMonth(date.getMonth() + amount)
  if (unit === 'years') date.setFullYear(date.getFullYear() + amount)

  return toISO(date)
}

// A job that has never been done is due now — that's the honest answer, and it
// stops brand-new entries hiding at the bottom of the list.
export function nextDue(job) {
  if (!job.last_done) return todayISO()
  return addInterval(job.last_done, job.interval_value, job.interval_unit)
}

export function daysUntil(iso, from = todayISO()) {
  return Math.round(
    (new Date(`${iso}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000,
  )
}

export function dueTone(iso) {
  const days = daysUntil(iso)
  if (days < 0) return 'score-low'
  if (days <= 14) return 'score-ok'
  return 'score-good'
}

export function intervalLabel(job) {
  const value = Number(job.interval_value) || 1
  const unit = value === 1 ? job.interval_unit.replace(/s$/, '') : job.interval_unit
  return value === 1 ? `every ${unit}` : `every ${value} ${unit}`
}

export function warrantyState(item) {
  if (!item.warranty_until) return null
  const days = daysUntil(item.warranty_until)
  if (days < 0) return { label: 'warranty expired', tone: 'score-low' }
  if (days <= 60) return { label: `warranty ends in ${days} days`, tone: 'score-ok' }
  return { label: `under warranty to ${item.warranty_until}`, tone: 'score-good' }
}
