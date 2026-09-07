import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import GoalsWeek from './GoalsWeek'
import GoalsPlan from './GoalsPlan'
import GoalsScoreboard from './GoalsScoreboard'
import EmptyState from './EmptyState'
import { todayISO } from './lib/taskDates'
import { weekNumberFor, cycleEnd, quarterOf } from './lib/twelveWeek'
import { report } from './lib/report'

const TABS = [
  { to: '/goals', label: 'This week', end: true },
  { to: '/goals/plan', label: 'The plan' },
  { to: '/goals/scoreboard', label: 'Scoreboard' },
]

// The 12 Week Year: a 12-week cycle with 1–3 goals, weekly tactics, and a
// weekly execution score. Week 13 is the buffer week for review and planning.
function Goals() {
  const [cycle, setCycle] = useState(undefined)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(todayISO())

  const loadCycle = useCallback(async () => {
    const { data, error } = await supabase
      .from('twy_cycles')
      .select('*')
      .in('status', ['planning', 'active'])
      .order('start_date', { ascending: false })
      .limit(1)

    if (error) {
      report('Failed to load cycle', error)
      setCycle(null)
      return
    }

    setCycle(data[0] || null)
  }, [])

  useEffect(() => {
    loadCycle()
  }, [loadCycle])

  async function createCycle(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('twy_cycles')
      .insert({ title: trimmed, start_date: startDate, status: 'active' })

    if (error) {
      report('Failed to create cycle', error)
      return
    }

    setTitle('')
    loadCycle()
  }

  if (cycle === undefined) return <p className="empty-text">Loading…</p>

  if (!cycle) {
    return (
      <section className="goals-module">
        <div className="home-greeting">
          <h1>Goals</h1>
          <p className="list-row-sub">Twelve weeks, not twelve months.</p>
        </div>

        <div className="card">
          <EmptyState icon="🎯" title="Start a 12-week cycle">
            Pick one to three goals you can genuinely move in twelve weeks. Each gets a
            lag measure — the outcome — and weekly tactics, which are the actions you
            actually control. You score yourself weekly on execution, not on the
            outcome. 85% is the number to beat.
          </EmptyState>

          <form onSubmit={createCycle}>
            <div className="field-row">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="cycle name — e.g. Autumn push"
              />
              <label>
                Starts
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <button type="submit">Start cycle</button>
            </div>
          </form>
          <p className="list-row-sub">
            Twelve weeks from {startDate} plus a buffer week — that&apos;s{' '}
            {quarterOf(startDate)}, ending {cycleEnd(startDate)}.
          </p>
        </div>
      </section>
    )
  }

  const week = weekNumberFor(cycle.start_date)

  return (
    <section className="goals-module">
      <div className="home-greeting">
        <h1>{cycle.title}</h1>
        <p className="list-row-sub">
          {week === 0
            ? `Starts ${cycle.start_date}`
            : week === null
              ? `Finished ${cycleEnd(cycle.start_date)} — time to plan the next one.`
              : week === 13
                ? 'Week 13 — buffer week. Review, rest, plan the next twelve.'
                : `Week ${week} of 12 · ${quarterOf(cycle.start_date)}`}
        </p>
      </div>

      <nav className="segmented-nav">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `segmented-tab${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<GoalsWeek cycle={cycle} />} />
        <Route path="plan" element={<GoalsPlan cycle={cycle} onCycleChange={loadCycle} />} />
        <Route path="scoreboard" element={<GoalsScoreboard cycle={cycle} />} />
        <Route path="*" element={<Navigate to="/goals" replace />} />
      </Routes>
    </section>
  )
}

export default Goals
