import { todayISO } from './taskDates'

export const CYCLE_WEEKS = 12
export const BUFFER_WEEK = 13
// The 12 Week Year benchmark: 85% of planned tactics executed.
export const TARGET_SCORE = 85

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekStart(startDate, weekNo) {
  const date = new Date(`${startDate}T12:00:00`)
  date.setDate(date.getDate() + (weekNo - 1) * 7)
  return toISO(date)
}

export function weekEnd(startDate, weekNo) {
  const date = new Date(`${startDate}T12:00:00`)
  date.setDate(date.getDate() + (weekNo - 1) * 7 + 6)
  return toISO(date)
}

export function cycleEnd(startDate) {
  return weekEnd(startDate, BUFFER_WEEK)
}

// Which week of the cycle a date falls in. 0 before it starts,
// null once the cycle (including the buffer week) is over.
export function weekNumberFor(startDate, iso = todayISO()) {
  const start = new Date(`${startDate}T12:00:00`)
  const day = new Date(`${iso}T12:00:00`)
  const diffDays = Math.floor((day - start) / 86400000)

  if (diffDays < 0) return 0

  const week = Math.floor(diffDays / 7) + 1
  return week > BUFFER_WEEK ? null : week
}

export function weekLabel(startDate, weekNo) {
  const start = new Date(`${weekStart(startDate, weekNo)}T12:00:00`)
  const end = new Date(`${weekEnd(startDate, weekNo)}T12:00:00`)
  const sameMonth = start.getMonth() === end.getMonth()

  const startText = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endText = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' },
  )

  return `${startText} – ${endText}`
}

// How many completions a tactic owes in a given week.
export function plannedFor(tactic, weekNo) {
  if (tactic.cadence === 'once') return tactic.due_week === weekNo ? 1 : 0
  return tactic.times_per_week || 1
}

// Execution score: completions ÷ commitments, capped at 100.
// This is the number the method actually asks you to watch — not the goal.
export function executionScore(tactics, logs, weekNo) {
  const planned = tactics.reduce((sum, tactic) => sum + plannedFor(tactic, weekNo), 0)
  if (planned === 0) return null

  const done = tactics.reduce((sum, tactic) => {
    const hits = logs.filter(
      (log) => log.tactic_id === tactic.id && log.week_no === weekNo,
    ).length
    return sum + Math.min(hits, plannedFor(tactic, weekNo))
  }, 0)

  return Math.round((done / planned) * 100)
}

export function scoreTone(score) {
  if (score === null) return ''
  if (score >= TARGET_SCORE) return 'score-good'
  if (score >= 65) return 'score-ok'
  return 'score-low'
}

// The quarter a cycle's start date sits in — used to tie a cycle to the
// Planning module's quarter view.
export function quarterOf(iso) {
  const date = new Date(`${iso}T12:00:00`)
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
}

// --- Goal scoreboard helpers -------------------------------------------------

// Days from the cycle start up to and including today, capped at the full
// cycle. Used as the denominator for habit consistency.
export function daysElapsed(startDate, iso = todayISO()) {
  const start = new Date(`${startDate}T12:00:00`)
  const day = new Date(`${iso}T12:00:00`)
  const diff = Math.floor((day - start) / 86400000) + 1
  const total = BUFFER_WEEK * 7
  return Math.max(0, Math.min(diff, total))
}

// Objectives are milestones — ticked off once each.
export function objectiveProgress(objectives) {
  const total = objectives.length
  if (total === 0) return null
  const done = objectives.filter((row) => row.done).length
  return { done, total, pct: Math.round((done / total) * 100) }
}

// Open/done task counts across every project pointed at a goal.
export function projectProgress(projects, tasks) {
  if (projects.length === 0) return null
  const ids = new Set(projects.map((project) => project.id))
  const mine = tasks.filter((task) => ids.has(task.project_id))
  const done = mine.filter((task) => task.status === 'done').length
  return {
    projects: projects.length,
    total: mine.length,
    done,
    pct: mine.length ? Math.round((done / mine.length) * 100) : null,
  }
}

// How often the goal's habits were actually kept, as a share of the days
// available so far. Same spirit as the execution score: effort, not outcome.
export function habitConsistency(habits, logs, startDate, iso = todayISO()) {
  if (habits.length === 0) return null

  const days = daysElapsed(startDate, iso)
  if (days <= 0) return { habits: habits.length, hits: 0, possible: 0, pct: null }

  const ids = new Set(habits.map((habit) => habit.id))
  const hits = logs.filter(
    (log) => ids.has(log.habit_id) && log.log_date >= startDate && log.log_date <= iso,
  ).length

  const possible = habits.length * days
  return { habits: habits.length, hits, possible, pct: Math.round((hits / possible) * 100) }
}
