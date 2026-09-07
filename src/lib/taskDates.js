export function todayISO() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

export function formatDueDate(iso) {
  if (!iso) return 'No date'

  const today = todayISO()
  if (iso === today) return 'Today'

  const dayMs = 86400000
  const diff = Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today}T00:00:00`)) / dayMs)

  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)} days ago`
  if (diff <= 6) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
  }

  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function isOverdue(iso) {
  return Boolean(iso) && iso < todayISO()
}
