// Seed list, carried over from the Notion "3 Words" property. Once the
// mood_words table exists these are inserted once and then it's yours to edit.
export const DEFAULT_MOOD_WORDS = [
  'happy',
  'grateful',
  'proud',
  'trying',
  'steady',
  'moving',
  'change',
  'recovery',
  'tired',
  'exhausted',
  'stressed',
  'burnt out',
  'frustrated',
  'fear',
]

// Hours slept, handling a bedtime before midnight and a wake time after.
export function sleepHours(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null

  const [bh, bm] = bedtime.split(':').map(Number)
  const [wh, wm] = wakeTime.split(':').map(Number)

  let minutes = wh * 60 + wm - (bh * 60 + bm)
  if (minutes <= 0) minutes += 24 * 60

  return minutes / 60
}

export function formatSleep(hours) {
  if (hours === null) return null
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  return mins ? `${whole}h ${mins}m` : `${whole}h`
}

export function shiftDate(iso, delta) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + delta)
  return date.toISOString().slice(0, 10)
}

// Consecutive days ending today (or yesterday, so a day in progress
// doesn't read as a broken streak).
export function streakFrom(dates, today) {
  const set = new Set(dates)
  let cursor = today
  let count = 0

  if (!set.has(cursor)) cursor = shiftDate(today, -1)

  while (set.has(cursor) && count < 999) {
    count += 1
    cursor = shiftDate(cursor, -1)
  }

  return count
}
