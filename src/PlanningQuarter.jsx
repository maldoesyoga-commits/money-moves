import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO } from './lib/taskDates'
import { formatMoney } from './lib/format'
import {
  CYCLE_WEEKS,
  BUFFER_WEEK,
  TARGET_SCORE,
  weekNumberFor,
  weekStart,
  weekEnd,
  weekLabel,
  cycleEnd,
  plannedFor,
  executionScore,
  scoreTone,
  quarterOf,
} from './lib/twelveWeek'
import EmptyState from './EmptyState'

// The quarter, seen through the 12 Week Year. The cycle is the spine;
// the three months hang off it.
function PlanningQuarter({ anchor, start, end, onPickWeek, onPickMonth }) {
  const [cycle, setCycle] = useState(undefined)
  const [goals, setGoals] = useState([])
  const [tactics, setTactics] = useState([])
  const [logs, setLogs] = useState([])
  const [months, setMonths] = useState([])

  const [focus, setFocus] = useState(null)
  const [focusDraft, setFocusDraft] = useState('')

  const loadCycle = useCallback(async () => {
    const { data, error } = await supabase
      .from('twy_cycles')
      .select('*')
      .in('status', ['planning', 'active'])
      .order('start_date', { ascending: false })
      .limit(1)

    if (error) {
      report('Failed to load the cycle', error)
      setCycle(null)
      return
    }

    const active = data[0] || null
    setCycle(active)

    if (!active) return

    const { data: goalRows } = await supabase
      .from('twy_goals')
      .select('*')
      .eq('cycle_id', active.id)
      .order('sort_order')

    setGoals(goalRows || [])

    const ids = (goalRows || []).map((goal) => goal.id)
    if (ids.length === 0) return

    const { data: tacticRows } = await supabase.from('twy_tactics').select('*').in('goal_id', ids)
    const { data: logRows } = await supabase.from('twy_tactic_logs').select('*')

    setTactics(tacticRows || [])
    setLogs(logRows || [])
  }, [])

  const loadFocus = useCallback(async () => {
    const { data, error } = await supabase
      .from('plan_entries')
      .select('*')
      .eq('horizon', 'quarter')
      .eq('start_date', start)

    if (error) {
      report('Failed to load the quarter plan', error)
      return
    }

    const found = (data || []).find((row) => row.entry_kind === 'intention') || null
    setFocus(found)
    setFocusDraft(found?.title || '')
  }, [start])

  // Counts for each of the quarter's three months.
  const loadMonths = useCallback(async () => {
    const first = new Date(`${start}T12:00:00`)
    const blocks = [0, 1, 2].map((offset) => {
      const monthStart = new Date(first.getFullYear(), first.getMonth() + offset, 1)
      const monthEnd = new Date(first.getFullYear(), first.getMonth() + offset + 1, 0)
      const iso = (date) => date.toISOString().slice(0, 10)
      return {
        anchor: iso(monthStart),
        start: iso(monthStart),
        end: iso(monthEnd),
        label: monthStart.toLocaleDateString(undefined, { month: 'long' }),
      }
    })

    const results = await Promise.all(
      blocks.map(async (block) => {
        const [taskRes, contentRes, invoiceRes] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, status')
            .gte('due_date', block.start)
            .lte('due_date', block.end),
          supabase
            .from('content_items')
            .select('id, stage')
            .gte('publish_date', block.start)
            .lte('publish_date', block.end),
          supabase
            .from('invoices')
            .select('id, amount, status')
            .gte('due_date', block.start)
            .lte('due_date', block.end),
        ])

        const tasks = taskRes.data || []
        const content = contentRes.data || []
        const invoices = invoiceRes.data || []

        return {
          ...block,
          openTasks: tasks.filter((task) => task.status !== 'done').length,
          doneTasks: tasks.filter((task) => task.status === 'done').length,
          content: content.length,
          owed: invoices
            .filter((invoice) => invoice.status === 'sent')
            .reduce((sum, invoice) => sum + Number(invoice.amount), 0),
        }
      }),
    )

    setMonths(results)
  }, [start])

  useEffect(() => {
    loadCycle()
    loadFocus()
    loadMonths()
  }, [loadCycle, loadFocus, loadMonths])

  async function saveFocus() {
    const trimmed = focusDraft.trim()

    if (!trimmed) {
      if (!focus) return
      const { error } = await supabase.from('plan_entries').delete().eq('id', focus.id)
      if (error) report('Failed to clear the quarter focus', error)
      else setFocus(null)
      return
    }

    if (focus) {
      const { error } = await supabase
        .from('plan_entries')
        .update({ title: trimmed })
        .eq('id', focus.id)

      if (error) report('Failed to save the quarter focus', error)
      else setFocus({ ...focus, title: trimmed })
      return
    }

    const { data, error } = await supabase
      .from('plan_entries')
      .insert({
        horizon: 'quarter',
        start_date: start,
        end_date: end,
        title: trimmed,
        entry_kind: 'intention',
        sort_order: -1,
      })
      .select()
      .single()

    if (error) report('Failed to save the quarter focus', error)
    else setFocus(data)
  }

  const currentWeek = cycle ? weekNumberFor(cycle.start_date) : null

  const weekScores = cycle
    ? Array.from({ length: CYCLE_WEEKS }, (_, i) => i + 1).map((week) => ({
        week,
        score: executionScore(
          tactics.filter((tactic) => plannedFor(tactic, week) > 0),
          logs,
          week,
        ),
        start: weekStart(cycle.start_date, week),
      }))
    : []

  const scored = weekScores.filter(
    (row) => row.score !== null && (currentWeek === null || row.week <= currentWeek),
  )
  const average = scored.length
    ? Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length)
    : null

  return (
    <>
      <div className="card intention-card">
        <h2>This quarter</h2>
        <p className="list-row-sub">The one thing that would make it count.</p>
        <input
          type="text"
          className="quick-add-title intention-input"
          value={focusDraft}
          onChange={(e) => setFocusDraft(e.target.value)}
          onBlur={saveFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="What this quarter is for…"
        />
      </div>

      {cycle === undefined ? null : !cycle ? (
        <div className="card">
          <EmptyState icon="🎯" title="No 12-week cycle running">
            The quarter and a 12-week cycle are the same stretch of time. Start one and
            this page fills in with your goals, weekly tactics and execution score.
          </EmptyState>
          <Link to="/goals" className="row-action-btn">
            Start a cycle
          </Link>
        </div>
      ) : (
        <>
          <div className="card cycle-panel">
            <div className="project-scope-header">
              <h2>{cycle.title}</h2>
              <Link to="/goals" className="row-action-btn">
                Open goals
              </Link>
            </div>

            <p className="list-row-sub">
              {cycle.start_date} → {cycleEnd(cycle.start_date)} · {quarterOf(cycle.start_date)}
              {quarterOf(cycle.start_date) !== quarterOf(start) && ' — offset from this quarter'}
            </p>

            <div className="review-grid budget-week-grid">
              <div className="review-stat">
                <span className="review-stat-value">
                  {currentWeek === null
                    ? 'done'
                    : currentWeek === 0
                      ? '—'
                      : currentWeek > CYCLE_WEEKS
                        ? 'buffer'
                        : currentWeek}
                </span>
                <span className="review-stat-label">
                  {currentWeek && currentWeek <= CYCLE_WEEKS ? 'Week of 12' : 'Cycle week'}
                </span>
              </div>
              <div className="review-stat">
                <span className={`review-stat-value ${scoreTone(average)}`}>
                  {average === null ? '—' : `${average}%`}
                </span>
                <span className="review-stat-label">Average execution</span>
                <span className="review-stat-sub">{TARGET_SCORE}% is the line</span>
              </div>
              <div className="review-stat">
                <span className="review-stat-value">{goals.length}</span>
                <span className="review-stat-label">Goals in play</span>
              </div>
            </div>

            <div className="quarter-weeks">
              {weekScores.map(({ week, score, start: weekStartIso }) => {
                const isNow = currentWeek === week
                const future = currentWeek !== null && currentWeek > 0 && week > currentWeek

                return (
                  <button
                    key={week}
                    type="button"
                    className={`quarter-week${isNow ? ' now' : ''}${future ? ' future' : ''}`}
                    onClick={() => onPickWeek(weekStartIso)}
                    title={`Week ${week} · ${weekLabel(cycle.start_date, week)}`}
                  >
                    <span className={`quarter-week-bar ${scoreTone(score)}`}>
                      <span
                        className="quarter-week-fill"
                        style={{ height: `${score || 0}%` }}
                      />
                    </span>
                    <span className="quarter-week-no">{week}</span>
                  </button>
                )
              })}
              <button
                type="button"
                className={`quarter-week buffer${currentWeek === BUFFER_WEEK ? ' now' : ''}`}
                onClick={() => onPickWeek(weekStart(cycle.start_date, BUFFER_WEEK))}
                title="Buffer week"
              >
                <span className="quarter-week-bar">
                  <span className="quarter-week-fill buffer-fill" />
                </span>
                <span className="quarter-week-no">13</span>
              </button>
            </div>
            <p className="list-row-sub">Tap a week to open it in the planner.</p>
          </div>

          {goals.length > 0 && (
            <div className="card">
              <h2>Goals</h2>
              <ul className="list">
                {goals.map((goal) => {
                  const pct =
                    goal.lag_target && Number(goal.lag_target) > 0
                      ? Math.min(
                          100,
                          Math.round((Number(goal.lag_current) / Number(goal.lag_target)) * 100),
                        )
                      : null

                  const goalTactics = tactics.filter((tactic) => tactic.goal_id === goal.id)
                  const weekScore =
                    currentWeek && currentWeek <= CYCLE_WEEKS
                      ? executionScore(
                          goalTactics.filter((tactic) => plannedFor(tactic, currentWeek) > 0),
                          logs,
                          currentWeek,
                        )
                      : null

                  return (
                    <li key={goal.id} className="list-row project-row">
                      <div className="task-row-body">
                        <span
                          className="project-dot"
                          style={{ background: goal.color || 'var(--sage)' }}
                        />
                        <div className="list-row-main task-main">
                          <span className="list-row-title">{goal.title}</span>
                          <span className="list-row-sub">
                            {goal.lag_measure || 'no lag measure'}
                            {pct !== null &&
                              ` — ${goal.lag_current} of ${goal.lag_target} ${goal.lag_unit || ''}`}
                          </span>
                        </div>
                        {weekScore !== null && (
                          <span className={`money ${scoreTone(weekScore)}`}>{weekScore}%</span>
                        )}
                      </div>

                      {pct !== null && (
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${pct}%`, background: goal.color || 'var(--sage)' }}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="card">
        <h2>The three months</h2>
        <div className="quarter-months">
          {months.map((month) => (
            <button
              key={month.anchor}
              type="button"
              className={`quarter-month${
                month.start <= todayISO() && month.end >= todayISO() ? ' now' : ''
              }`}
              onClick={() => onPickMonth(month.anchor)}
            >
              <span className="quarter-month-name">{month.label}</span>
              <span className="quarter-month-stat">
                {month.openTasks} open · {month.doneTasks} done
              </span>
              {month.content > 0 && (
                <span className="quarter-month-stat">{month.content} posts</span>
              )}
              {month.owed > 0 && (
                <span className="quarter-month-stat owed">{formatMoney(month.owed)} owed</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default PlanningQuarter
