// Half-hour grid for the daily planner.

export const SLOT_MIN = 30
export const DEFAULT_START = 6 * 60 // 6am
export const DEFAULT_END = 22 * 60 // 10pm

export const BLOCK_KINDS = [
  { value: 'focus', label: 'Focus' },
  { value: 'admin', label: 'Admin' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'break', label: 'Break' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
]

export function slots(startMin = DEFAULT_START, endMin = DEFAULT_END) {
  const out = []
  for (let min = startMin; min < endMin; min += SLOT_MIN) out.push(min)
  return out
}

export function formatSlot(min) {
  const hour = Math.floor(min / 60)
  const mins = min % 60
  const suffix = hour < 12 || hour === 24 ? 'am' : 'pm'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(mins).padStart(2, '0')}${suffix}`
}

export function nowMin() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

// The slot the current time falls in, rounded down to the half hour.
export function currentSlot() {
  return Math.floor(nowMin() / SLOT_MIN) * SLOT_MIN
}

export function slotsCovered(block) {
  const count = Math.max(1, Math.round(block.duration_min / SLOT_MIN))
  return Array.from({ length: count }, (_, i) => block.start_min + i * SLOT_MIN)
}
