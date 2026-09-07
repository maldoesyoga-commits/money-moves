import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'
import {
  weekNumberFor,
  weekLabel,
  plannedFor,
  executionScore,
  scoreTone,
  TARGET_SCORE,
  BUFFER_WEEK,
} from './lib/twelveWeek'
import EmptyState from './EmptyState'

function GoalsWeek({ cycle }) {
  const current = weekNumberFor(cycle.start_date) || 1
  const [week, setWeek] = useState(Math.min(Math.max(current, 1), BUFFER_WEEK))

  const [goals, setGoals] = useState([])
  const [tactics, setTactics] = useState([])
  const [logs, setLogs] = useState([])

  const load = useCallback(async () => {
    const { data: goalRows, error: goalError } = await supabase
      .from('twy_goals')
      .select('*')
      .eq('cycle_id', cycle.id)
      .order('sort_order')

    if (goalError) {
      console.log('Failed to load goals', goalError.message)
      return
    }

    setGoals(goalRows)

    const ids = goalRows.map((goal) => goal.id)
    if (ids.length === 0) {
      setTactics([])
      setLogs([])
      return
    }

    const { data: tacticRows, error: tacticError } = await supabase
      .from('twy_tactics')
      .select('*')
      .in('goal_id', ids)
      .order('sort_order')

    if (tacticError) {
      console.log('Failed to load tactics', tacticError.message)
      return
    }

    setTactics(tacticRows)

    const { data: logRows, error: logError } = await supabase
      .from('twy_tactic_logs')
      .select('*')

    if (logError) {
      console.log('Failed to load tactic logs', logError.message)
      return
    }

    setLogs(logRows)
  }, [cycle.id])

  useEffect(() => {
    load()
  }, [load])

  const dueThisWeek = tactics.filter((tactic) => plannedFor(tactic, week) > 0)
  const score = executionScore(dueThisWeek, logs, week)

  function hitsFor(tacticId) {
    return logs.filter((log) => log.tactic_id === tacticId && log.week_no === week).length
  }

  async function logHit(tactic) {
    const { data, error } = await supabase
      .from('twy_tactic_logs')
      .insert({ tactic_id: tactic.id, week_no: week, done_on: todayISO() })
      .select()
      .single()

    if (error) {
      console.log('Failed to log tactic', error.message)
      return
    }

    setLogs((prev) => [...prev, data])
  }

  async function undoHit(tactic) {
    const mine = logs.filter((log) => log.tactic_id === tactic.id && log.week_no === week)
    const last = mine[mine.length - 1]
    if (!last) return

    setLogs((prev) => prev.filter((log) => log.id !== last.id))

    const { error } = await supabase.from('twy_tactic_logs').delete().eq('id', last.id)

    if (error) {
      console.log('Failed to undo tactic log', error.message)
      load()
    }
  }

  if (goals.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="🎯" title="No goals in this cycle yet">
          Head to <strong>The plan</strong> and add one to three goals, then the weekly
          tactics under each. They show up here to tick off.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setWeek(Math.max(1, week - 1))}
          disabled={week <= 1}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>Week {week}</span>
          <span className="list-row-sub">{weekLabel(cycle.start_date, week)}</span>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setWeek(Math.min(BUFFER_WEEK, week + 1))}
          disabled={week >= BUFFER_WEEK}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <div className="card score-card">
        <div className="total-row">
          <p>Execution score</p>
          <span className={`score-value ${scoreTone(score)}`}>
            {score === null ? '—' : `${score}%`}
          </span>
        </div>

        <div className="progress-track score-track">
          <div
            className={`progress-fill ${scoreTone(score)}`}
            style={{ width: `${score || 0}%` }}
          />
          <span className="score-target" style={{ left: `${TARGET_SCORE}%` }} />
        </div>

        <p className="list-row-sub">
          {score === null
            ? 'Nothing committed for this week yet.'
            : score >= TARGET_SCORE
              ? `Above the ${TARGET_SCORE}% line. This is the week that counts, not the outcome.`
              : `${TARGET_SCORE}% is the line. You're measuring what you did, not what happened.`}
        </p>
      </div>

      {goals.map((goal) => {
        const goalTactics = dueThisWeek.filter((tactic) => tactic.goal_id === goal.id)
        if (goalTactics.length === 0) return null

        return (
          <div className="card" key={goal.id}>
            <div className="project-scope-header">
              <div className="project-title-row">
                <span
                  className="project-dot"
                  style={{ background: goal.color || 'var(--sage)' }}
                />
                <h2>{goal.title}</h2>
              </div>
              <span className="list-row-sub">
                {executionScore(goalTactics, logs, week) ?? 0}%
              </span>
            </div>

            <ul className="list">
              {goalTactics.map((tactic) => {
                const planned = plannedFor(tactic, week)
                const hits = hitsFor(tactic.id)
                const complete = hits >= planned

                return (
                  <li key={tactic.id} className={`list-row task-row${complete ? ' task-done' : ''}`}>
                    <div className="task-row-body">
                      <button
                        type="button"
                        className={`task-check${complete ? ' checked' : ''}`}
                        onClick={() => (complete ? undoHit(tactic) : logHit(tactic))}
                        aria-label={complete ? 'Undo' : 'Mark done'}
                      >
                        {complete ? '✓' : ''}
                      </button>

                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">{tactic.title}</span>
                        <span className="list-row-sub">
                          {tactic.cadence === 'once'
                            ? `one-off · week ${tactic.due_week}`
                            : `${hits} of ${planned} this week`}
                        </span>
                      </div>

                      {planned > 1 && (
                        <div className="tally">
                          {Array.from({ length: planned }, (_, i) => (
                            <span key={i} className={`tally-mark${i < hits ? ' on' : ''}`} />
                          ))}
                        </div>
                      )}

                      <div className="stage-nudge">
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => undoHit(tactic)}
                          disabled={hits === 0}
                          aria-label="Remove one"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => logHit(tactic)}
                          aria-label="Add one"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {dueThisWeek.length === 0 && (
        <div className="card">
          <p className="empty-text">
            Nothing committed for week {week}. Add tactics under The plan.
          </p>
        </div>
      )}
    </>
  )
}

export default GoalsWeek
