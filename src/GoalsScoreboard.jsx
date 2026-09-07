import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  CYCLE_WEEKS,
  TARGET_SCORE,
  weekNumberFor,
  weekLabel,
  plannedFor,
  executionScore,
  scoreTone,
} from './lib/twelveWeek'
import EmptyState from './EmptyState'

function GoalsScoreboard({ cycle }) {
  const [goals, setGoals] = useState([])
  const [tactics, setTactics] = useState([])
  const [logs, setLogs] = useState([])

  const load = useCallback(async () => {
    const { data: goalRows, error } = await supabase
      .from('twy_goals')
      .select('*')
      .eq('cycle_id', cycle.id)
      .order('sort_order')

    if (error) {
      console.log('Failed to load goals', error.message)
      return
    }

    setGoals(goalRows)

    const ids = goalRows.map((goal) => goal.id)
    if (ids.length === 0) return

    const { data: tacticRows } = await supabase.from('twy_tactics').select('*').in('goal_id', ids)
    const { data: logRows } = await supabase.from('twy_tactic_logs').select('*')

    setTactics(tacticRows || [])
    setLogs(logRows || [])
  }, [cycle.id])

  useEffect(() => {
    load()
  }, [load])

  const currentWeek = weekNumberFor(cycle.start_date)
  const weeks = Array.from({ length: CYCLE_WEEKS }, (_, i) => i + 1)

  const scores = weeks.map((week) => {
    const due = tactics.filter((tactic) => plannedFor(tactic, week) > 0)
    return { week, score: executionScore(due, logs, week) }
  })

  const scored = scores.filter(
    (row) => row.score !== null && (currentWeek === null || row.week <= currentWeek),
  )
  const average = scored.length
    ? Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length)
    : null
  const above = scored.filter((row) => row.score >= TARGET_SCORE).length

  if (goals.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="📊" title="Nothing to score yet">
          Once there are goals and tactics in the plan, every week gets a score here and
          you can see the whole twelve at a glance.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <div className="review-grid">
        <div className="review-stat">
          <span className="review-stat-value">{average === null ? '—' : `${average}%`}</span>
          <span className="review-stat-label">Average execution</span>
          <span className="review-stat-sub">across {scored.length} weeks</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{above}</span>
          <span className="review-stat-label">Weeks at 85%+</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">
            {currentWeek === null ? 'done' : currentWeek === 0 ? '—' : currentWeek}
          </span>
          <span className="review-stat-label">Current week</span>
        </div>
      </div>

      <div className="card">
        <h2>Week by week</h2>
        <p className="list-row-sub">
          The line is {TARGET_SCORE}%. Hitting it most weeks is what the method is
          actually asking of you.
        </p>

        <div className="score-bars">
          {scores.map(({ week, score }) => {
            const future = currentWeek !== null && currentWeek > 0 && week > currentWeek

            return (
              <div className="score-bar" key={week} title={weekLabel(cycle.start_date, week)}>
                <div className="score-bar-track">
                  <div
                    className={`score-bar-fill ${scoreTone(score)}${future ? ' future' : ''}`}
                    style={{ height: `${score || 0}%` }}
                  />
                  <span className="score-bar-target" />
                </div>
                <span className="score-bar-label">{week}</span>
                <span className="score-bar-value">{score === null ? '' : score}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2>Goal progress</h2>
        {goals.map((goal) => {
          const pct =
            goal.lag_target && Number(goal.lag_target) > 0
              ? Math.min(
                  100,
                  Math.round((Number(goal.lag_current) / Number(goal.lag_target)) * 100),
                )
              : null

          return (
            <div className="goal-progress-block" key={goal.id}>
              <div className="budget-row-header">
                <span className="list-row-title">{goal.title}</span>
                <span className="list-row-sub">
                  {pct === null
                    ? goal.lag_measure || 'no lag measure set'
                    : `${goal.lag_current} of ${goal.lag_target} ${goal.lag_unit || ''} (${pct}%)`}
                </span>
              </div>
              {pct !== null && (
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${pct}%`, background: goal.color || 'var(--sage)' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default GoalsScoreboard
