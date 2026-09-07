import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { cycleEnd, quarterOf, CYCLE_WEEKS } from './lib/twelveWeek'
import EmptyState from './EmptyState'
import { report } from './lib/report'

const COLORS = ['#3f6b5c', '#b87333', '#4e6e8a', '#bf8f6b', '#6e7a75']

function GoalsPlan({ cycle, onCycleChange }) {
  const [goals, setGoals] = useState([])
  const [tactics, setTactics] = useState([])
  const [openId, setOpenId] = useState(null)

  const [vision, setVision] = useState(cycle.vision || '')
  const [goalTitle, setGoalTitle] = useState('')
  const [tacticDrafts, setTacticDrafts] = useState({})

  const load = useCallback(async () => {
    const { data: goalRows, error } = await supabase
      .from('twy_goals')
      .select('*')
      .eq('cycle_id', cycle.id)
      .order('sort_order')

    if (error) {
      report('Failed to load goals', error)
      return
    }

    setGoals(goalRows)

    const ids = goalRows.map((goal) => goal.id)
    if (ids.length === 0) {
      setTactics([])
      return
    }

    const { data: tacticRows, error: tacticError } = await supabase
      .from('twy_tactics')
      .select('*')
      .in('goal_id', ids)
      .order('sort_order')

    if (tacticError) {
      report('Failed to load tactics', tacticError)
      return
    }

    setTactics(tacticRows)
  }, [cycle.id])

  useEffect(() => {
    load()
  }, [load])

  async function saveVision() {
    const { error } = await supabase
      .from('twy_cycles')
      .update({ vision: vision || null })
      .eq('id', cycle.id)

    if (error) report('Failed to save vision', error)
  }

  async function addGoal(e) {
    e.preventDefault()

    const trimmed = goalTitle.trim()
    if (!trimmed) return

    const { error } = await supabase.from('twy_goals').insert({
      cycle_id: cycle.id,
      title: trimmed,
      color: COLORS[goals.length % COLORS.length],
      sort_order: goals.length,
    })

    if (error) {
      report('Failed to add goal', error)
      return
    }

    setGoalTitle('')
    load()
  }

  async function updateGoal(id, patch) {
    setGoals((prev) => prev.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)))

    const { error } = await supabase.from('twy_goals').update(patch).eq('id', id)

    if (error) {
      report('Failed to update goal', error)
      load()
    }
  }

  async function deleteGoal(id) {
    setGoals((prev) => prev.filter((goal) => goal.id !== id))

    const { error } = await supabase.from('twy_goals').delete().eq('id', id)

    if (error) {
      report('Failed to delete goal', error)
      load()
    }
  }

  async function addTactic(e, goalId) {
    e.preventDefault()

    const draft = tacticDrafts[goalId] || {}
    const trimmed = (draft.title || '').trim()
    if (!trimmed) return

    const payload = {
      goal_id: goalId,
      title: trimmed,
      cadence: draft.cadence || 'weekly',
      times_per_week: Number(draft.times || 1),
      sort_order: tactics.filter((tactic) => tactic.goal_id === goalId).length,
    }

    if (payload.cadence === 'once') payload.due_week = Number(draft.week || 1)

    const { error } = await supabase.from('twy_tactics').insert(payload)

    if (error) {
      report('Failed to add tactic', error)
      return
    }

    setTacticDrafts((prev) => ({ ...prev, [goalId]: {} }))
    load()
  }

  async function updateTactic(id, patch) {
    setTactics((prev) => prev.map((tactic) => (tactic.id === id ? { ...tactic, ...patch } : tactic)))

    const { error } = await supabase.from('twy_tactics').update(patch).eq('id', id)

    if (error) {
      report('Failed to update tactic', error)
      load()
    }
  }

  async function deleteTactic(id) {
    setTactics((prev) => prev.filter((tactic) => tactic.id !== id))

    const { error } = await supabase.from('twy_tactics').delete().eq('id', id)

    if (error) {
      report('Failed to delete tactic', error)
      load()
    }
  }

  async function finishCycle() {
    const { error } = await supabase
      .from('twy_cycles')
      .update({ status: 'done' })
      .eq('id', cycle.id)

    if (error) {
      report('Failed to close cycle', error)
      return
    }

    onCycleChange?.()
  }

  function draftFor(goalId, key, fallback) {
    return tacticDrafts[goalId]?.[key] ?? fallback
  }

  function setDraft(goalId, key, value) {
    setTacticDrafts((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [key]: value } }))
  }

  return (
    <>
      <div className="card">
        <h2>Vision</h2>
        <p className="list-row-sub">
          What the next few years look like if this goes well. The twelve weeks are a
          down payment on it.
        </p>
        <textarea
          rows="4"
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          onBlur={saveVision}
          placeholder="Where this is all heading…"
        />
        <p className="list-row-sub">
          Cycle runs {cycle.start_date} → {cycleEnd(cycle.start_date)} ·{' '}
          {quarterOf(cycle.start_date)}
        </p>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Goals</h2>
          <span className="list-row-sub">{goals.length} of 3</span>
        </div>

        {goals.length >= 3 && (
          <p className="budget-gentle-note">
            Three is the ceiling the method suggests. More than that and none of them move.
          </p>
        )}

        <form className="field-row" onSubmit={addGoal}>
          <input
            type="text"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="goal — the outcome you want in 12 weeks"
          />
          <button type="submit">Add goal</button>
        </form>

        {goals.length === 0 && (
          <EmptyState icon="🎯" title="No goals yet">
            One to three. Make each one something you could actually finish in twelve
            weeks — not a theme, an outcome.
          </EmptyState>
        )}
      </div>

      {goals.map((goal) => {
        const goalTactics = tactics.filter((tactic) => tactic.goal_id === goal.id)
        const open = openId === goal.id
        const pct =
          goal.lag_target && Number(goal.lag_target) > 0
            ? Math.min(100, Math.round((Number(goal.lag_current) / Number(goal.lag_target)) * 100))
            : null

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
              <button
                type="button"
                className="row-action-btn"
                onClick={() => setOpenId(open ? null : goal.id)}
              >
                {open ? 'Close' : 'Edit'}
              </button>
            </div>

            {goal.lag_measure && (
              <>
                <div className="total-row">
                  <p>{goal.lag_measure}</p>
                  <span className="money">
                    {goal.lag_current}
                    {goal.lag_target ? ` / ${goal.lag_target}` : ''} {goal.lag_unit || ''}
                  </span>
                </div>
                {pct !== null && (
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </>
            )}

            {open && (
              <div className="learning-detail">
                <input
                  type="text"
                  value={goal.title}
                  onChange={(e) => updateGoal(goal.id, { title: e.target.value })}
                  placeholder="goal"
                />
                <textarea
                  rows="2"
                  value={goal.why || ''}
                  onChange={(e) => updateGoal(goal.id, { why: e.target.value || null })}
                  placeholder="why this one matters — you'll need this in week 7"
                />
                <div className="task-controls">
                  <input
                    type="text"
                    className="inline-select"
                    value={goal.lag_measure || ''}
                    onChange={(e) => updateGoal(goal.id, { lag_measure: e.target.value || null })}
                    placeholder="lag measure"
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="inline-select"
                    value={goal.lag_current}
                    onChange={(e) =>
                      updateGoal(goal.id, { lag_current: Number(e.target.value) || 0 })
                    }
                    placeholder="now"
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="inline-select"
                    value={goal.lag_target || ''}
                    onChange={(e) =>
                      updateGoal(goal.id, {
                        lag_target: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="target"
                  />
                  <input
                    type="text"
                    className="target-input"
                    value={goal.lag_unit || ''}
                    onChange={(e) => updateGoal(goal.id, { lag_unit: e.target.value || null })}
                    placeholder="unit"
                  />
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => deleteGoal(goal.id)}
                  >
                    Delete goal
                  </button>
                </div>
                <div className="color-picker-row">
                  {COLORS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`color-swatch${goal.color === swatch ? ' selected' : ''}`}
                      style={{ background: swatch }}
                      onClick={() => updateGoal(goal.id, { color: swatch })}
                      aria-label={`Colour ${swatch}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <h3>Tactics</h3>
            <p className="list-row-sub">
              The weekly actions. These are what you score yourself on.
            </p>

            {goalTactics.length === 0 ? (
              <p className="empty-text">No tactics yet.</p>
            ) : (
              <ul className="list">
                {goalTactics.map((tactic) => (
                  <li key={tactic.id} className="list-row">
                    <div className="list-row-main">
                      <span className="list-row-title">{tactic.title}</span>
                      <span className="list-row-sub">
                        {tactic.cadence === 'weekly'
                          ? `${tactic.times_per_week}× a week`
                          : `once, week ${tactic.due_week}`}
                      </span>
                    </div>
                    <div className="stage-nudge">
                      {tactic.cadence === 'weekly' && (
                        <input
                          type="number"
                          min="1"
                          max="14"
                          className="target-input"
                          value={tactic.times_per_week}
                          onChange={(e) =>
                            updateTactic(tactic.id, {
                              times_per_week: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      )}
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteTactic(tactic.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form className="field-row tactic-form" onSubmit={(e) => addTactic(e, goal.id)}>
              <input
                type="text"
                value={draftFor(goal.id, 'title', '')}
                onChange={(e) => setDraft(goal.id, 'title', e.target.value)}
                placeholder="tactic — an action, not an outcome"
              />
              <select
                value={draftFor(goal.id, 'cadence', 'weekly')}
                onChange={(e) => setDraft(goal.id, 'cadence', e.target.value)}
              >
                <option value="weekly">Every week</option>
                <option value="once">One-off</option>
              </select>
              {draftFor(goal.id, 'cadence', 'weekly') === 'weekly' ? (
                <input
                  type="number"
                  min="1"
                  max="14"
                  className="target-input"
                  value={draftFor(goal.id, 'times', 1)}
                  onChange={(e) => setDraft(goal.id, 'times', e.target.value)}
                  placeholder="×/wk"
                />
              ) : (
                <select
                  className="inline-select"
                  value={draftFor(goal.id, 'week', 1)}
                  onChange={(e) => setDraft(goal.id, 'week', e.target.value)}
                >
                  {Array.from({ length: CYCLE_WEEKS }, (_, i) => i + 1).map((week) => (
                    <option key={week} value={week}>
                      Week {week}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className="btn-secondary">
                Add tactic
              </button>
            </form>
          </div>
        )
      })}

      <div className="card">
        <h2>End this cycle</h2>
        <p className="list-row-sub">
          Closing it keeps everything for the scoreboard and clears the way for the next
          twelve weeks.
        </p>
        <button type="button" className="btn-secondary" onClick={finishCycle}>
          Close cycle
        </button>
      </div>
    </>
  )
}

export default GoalsPlan
