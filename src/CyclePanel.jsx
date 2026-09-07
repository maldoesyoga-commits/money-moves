import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import {
  weekNumberFor,
  weekLabel,
  plannedFor,
  executionScore,
  scoreTone,
  cycleEnd,
  BUFFER_WEEK,
} from './lib/twelveWeek'

// The 12-week cycle as seen from Planning. Shows where the cycle sits
// against whatever horizon you're looking at, and this week's score.
function CyclePanel({ horizon, start, end }) {
  const [cycle, setCycle] = useState(null)
  const [goals, setGoals] = useState([])
  const [tactics, setTactics] = useState([])
  const [logs, setLogs] = useState([])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('twy_cycles')
      .select('*')
      .in('status', ['planning', 'active'])
      .order('start_date', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return

    const active = data[0]
    setCycle(active)

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

  useEffect(() => {
    load()
  }, [load])

  if (!cycle) return null

  // Which cycle week the period you're viewing starts in.
  const week = weekNumberFor(cycle.start_date, start)
  const overlaps = cycleEnd(cycle.start_date) >= start && cycle.start_date <= end

  if (!overlaps) return null

  const shown = week && week >= 1 && week <= BUFFER_WEEK ? week : null
  const due = shown ? tactics.filter((tactic) => plannedFor(tactic, shown) > 0) : []
  const score = shown ? executionScore(due, logs, shown) : null

  return (
    <div className="card cycle-panel">
      <div className="project-scope-header">
        <h2>{cycle.title}</h2>
        <Link to="/goals" className="row-action-btn">
          Open goals
        </Link>
      </div>

      <p className="list-row-sub">
        {shown === null
          ? `Runs ${cycle.start_date} → ${cycleEnd(cycle.start_date)}`
          : shown === BUFFER_WEEK
            ? 'Buffer week — review and plan the next twelve.'
            : `Week ${shown} of 12 · ${weekLabel(cycle.start_date, shown)}`}
      </p>

      {shown !== null && score !== null && (
        <>
          <div className="total-row">
            <p>Execution {horizon === 'week' ? 'this week' : `week ${shown}`}</p>
            <span className={`score-value ${scoreTone(score)}`}>{score}%</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${scoreTone(score)}`} style={{ width: `${score}%` }} />
          </div>
        </>
      )}

      {goals.length > 0 && (
        <ul className="list">
          {goals.map((goal) => {
            const pct =
              goal.lag_target && Number(goal.lag_target) > 0
                ? Math.min(
                    100,
                    Math.round((Number(goal.lag_current) / Number(goal.lag_target)) * 100),
                  )
                : null

            return (
              <li key={goal.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">
                    <span
                      className="project-dot inline-dot"
                      style={{ background: goal.color || 'var(--sage)' }}
                    />
                    {goal.title}
                  </span>
                  {goal.lag_measure && (
                    <span className="list-row-sub">
                      {goal.lag_measure}
                      {pct !== null ? ` — ${pct}%` : ''}
                    </span>
                  )}
                </div>
                {pct !== null && <span className="money">{pct}%</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default CyclePanel
