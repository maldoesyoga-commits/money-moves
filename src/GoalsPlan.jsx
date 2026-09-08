import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { cycleEnd, quarterOf, CYCLE_WEEKS } from './lib/twelveWeek'
import EmptyState from './EmptyState'
import GoalsGlossary from './GoalsGlossary'
import MilestoneList from './MilestoneList'
import { report } from './lib/report'

const COLORS = ['#3f6b5c', '#b87333', '#4e6e8a', '#bf8f6b', '#6e7a75']

function GoalsPlan({ cycle, onCycleChange }) {
  const [goals, setGoals] = useState([])
  const [objectives, setObjectives] = useState([])
  const [tactics, setTactics] = useState([])
  const [projects, setProjects] = useState([])
  const [habits, setHabits] = useState([])
  const [openId, setOpenId] = useState(null)

  const [vision, setVision] = useState(cycle.vision || '')
  const [goalTitle, setGoalTitle] = useState('')
  const [drafts, setDrafts] = useState({})

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

    // Projects and habits load either way — the pickers need the unlinked ones.
    const [{ data: projectRows }, { data: habitRows }] = await Promise.all([
      supabase.from('projects').select('*').order('sort_order').order('created_at'),
      supabase.from('habits').select('*').order('sort_order').order('created_at'),
    ])

    setProjects(projectRows || [])
    setHabits(habitRows || [])

    const ids = goalRows.map((goal) => goal.id)
    if (ids.length === 0) {
      setTactics([])
      setObjectives([])
      return
    }

    const [{ data: tacticRows, error: tacticError }, { data: objectiveRows, error: objectiveError }] =
      await Promise.all([
        supabase.from('twy_tactics').select('*').in('goal_id', ids).order('sort_order'),
        supabase.from('twy_objectives').select('*').in('goal_id', ids).order('sort_order'),
      ])

    if (tacticError) report('Failed to load tactics', tacticError)
    else setTactics(tacticRows)

    if (objectiveError) report('Failed to load objectives', objectiveError)
    else setObjectives(objectiveRows)
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

  // --- goals -----------------------------------------------------------------

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
    }

    // Projects and habits survive the goal — reload so their links clear.
    load()
  }

  // --- objectives ------------------------------------------------------------

  async function addObjective(e, goalId) {
    e.preventDefault()

    const trimmed = (draftFor(goalId, 'objective', '') || '').trim()
    if (!trimmed) return

    const { error } = await supabase.from('twy_objectives').insert({
      goal_id: goalId,
      title: trimmed,
      sort_order: objectives.filter((row) => row.goal_id === goalId).length,
    })

    if (error) {
      report('Failed to add objective', error)
      return
    }

    setDraft(goalId, 'objective', '')
    load()
  }

  async function toggleObjective(objective) {
    const patch = {
      done: !objective.done,
      done_at: objective.done ? null : new Date().toISOString(),
    }

    setObjectives((prev) =>
      prev.map((row) => (row.id === objective.id ? { ...row, ...patch } : row)),
    )

    const { error } = await supabase.from('twy_objectives').update(patch).eq('id', objective.id)

    if (error) {
      report('Failed to update objective', error)
      load()
    }
  }

  async function deleteObjective(id) {
    setObjectives((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('twy_objectives').delete().eq('id', id)

    if (error) {
      report('Failed to delete objective', error)
      load()
    }
  }

  // --- tactics ---------------------------------------------------------------

  async function addTactic(e, goalId) {
    e.preventDefault()

    const trimmed = (draftFor(goalId, 'title', '') || '').trim()
    if (!trimmed) return

    const payload = {
      goal_id: goalId,
      title: trimmed,
      cadence: draftFor(goalId, 'cadence', 'weekly'),
      times_per_week: Number(draftFor(goalId, 'times', 1)) || 1,
      sort_order: tactics.filter((tactic) => tactic.goal_id === goalId).length,
    }

    if (payload.cadence === 'once') payload.due_week = Number(draftFor(goalId, 'week', 1))

    const { error } = await supabase.from('twy_tactics').insert(payload)

    if (error) {
      report('Failed to add tactic', error)
      return
    }

    setDrafts((prev) => ({ ...prev, [goalId]: {} }))
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

  // --- linked projects & habits ---------------------------------------------

  async function setProjectGoal(projectId, goalId) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, twy_goal_id: goalId } : project,
      ),
    )

    const { error } = await supabase
      .from('projects')
      .update({ twy_goal_id: goalId })
      .eq('id', projectId)

    if (error) {
      report('Failed to link project', error)
      load()
    }
  }

  async function createProjectForGoal(e, goal) {
    e.preventDefault()

    const trimmed = (draftFor(goal.id, 'project', '') || '').trim()
    if (!trimmed) return

    const { error } = await supabase.from('projects').insert({
      name: trimmed,
      twy_goal_id: goal.id,
      color: goal.color,
      sort_order: projects.length,
    })

    if (error) {
      report('Failed to create project', error)
      return
    }

    setDraft(goal.id, 'project', '')
    load()
  }

  async function setHabitGoal(habitId, goalId) {
    setHabits((prev) =>
      prev.map((habit) => (habit.id === habitId ? { ...habit, twy_goal_id: goalId } : habit)),
    )

    const { error } = await supabase
      .from('habits')
      .update({ twy_goal_id: goalId })
      .eq('id', habitId)

    if (error) {
      report('Failed to link habit', error)
      load()
    }
  }

  async function createHabitForGoal(e, goal) {
    e.preventDefault()

    const trimmed = (draftFor(goal.id, 'habit', '') || '').trim()
    if (!trimmed) return

    const { error } = await supabase.from('habits').insert({
      name: trimmed,
      twy_goal_id: goal.id,
      sort_order: habits.length,
    })

    if (error) {
      report('Failed to create habit', error)
      return
    }

    setDraft(goal.id, 'habit', '')
    load()
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
    return drafts[goalId]?.[key] ?? fallback
  }

  function setDraft(goalId, key, value) {
    setDrafts((prev) => ({ ...prev, [goalId]: { ...prev[goalId], [key]: value } }))
  }

  return (
    <>
      <GoalsGlossary />

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
        const goalObjectives = objectives.filter((row) => row.goal_id === goal.id)
        const goalTactics = tactics.filter((tactic) => tactic.goal_id === goal.id)
        const goalProjects = projects.filter((project) => project.twy_goal_id === goal.id)
        const goalHabits = habits.filter((habit) => habit.twy_goal_id === goal.id)
        const freeProjects = projects.filter((project) => !project.twy_goal_id)
        const freeHabits = habits.filter((habit) => !habit.twy_goal_id && habit.active)
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

            {goal.aim && <p className="list-row-sub">Aim — {goal.aim}</p>}

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

                <p className="budget-gentle-note">
                  <strong>Aim</strong> — the broad ambition this goal is a slice of. One
                  line, no numbers, no deadline: &ldquo;Hope Heals supports itself without
                  me chasing every client.&rdquo; The goal above is that aim narrowed to
                  twelve weeks with a number on it.
                </p>
                <textarea
                  rows="2"
                  value={goal.aim || ''}
                  onChange={(e) => updateGoal(goal.id, { aim: e.target.value || null })}
                  placeholder="the ambition behind this — what you're really reaching for"
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

            <h3>Objectives</h3>
            <p className="list-row-sub">
              The milestones that have to be true for this goal to land. Ticked off once
              each — if it repeats every week, it belongs under Tactics.
            </p>

            {goalObjectives.length === 0 ? (
              <p className="empty-text">No objectives yet.</p>
            ) : (
              <ul className="list">
                {goalObjectives.map((objective) => (
                  <li
                    key={objective.id}
                    className={`list-row task-row${objective.done ? ' task-done' : ''}`}
                  >
                    <div className="task-row-body">
                      <button
                        type="button"
                        className={`task-check${objective.done ? ' checked' : ''}`}
                        onClick={() => toggleObjective(objective)}
                        aria-label={objective.done ? 'Reopen' : 'Mark done'}
                      >
                        {objective.done ? '✓' : ''}
                      </button>
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">{objective.title}</span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteObjective(objective.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form className="field-row" onSubmit={(e) => addObjective(e, goal.id)}>
              <input
                type="text"
                value={draftFor(goal.id, 'objective', '')}
                onChange={(e) => setDraft(goal.id, 'objective', e.target.value)}
                placeholder="objective — a milestone, done or not done"
              />
              <button type="submit" className="btn-secondary">
                Add objective
              </button>
            </form>

            <MilestoneList
              goalId={goal.id}
              hint="Moments worth marking on the way to this goal. Objectives are what must be true; milestones are what you'll remember."
            />

            <h3>Tactics</h3>
            <p className="list-row-sub">
              The weekly actions. These are the only thing you score yourself on.
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

            <h3>Projects</h3>
            <p className="list-row-sub">
              Work that belongs to this goal. Tasks stay in the planner — the goal just
              borrows their progress for the scoreboard.
            </p>

            {goalProjects.length === 0 ? (
              <p className="empty-text">No projects linked.</p>
            ) : (
              <ul className="list">
                {goalProjects.map((project) => (
                  <li key={project.id} className="list-row">
                    <div className="task-row-body">
                      <span
                        className="project-dot"
                        style={{ background: project.color || 'var(--text-soft)' }}
                      />
                      <div className="list-row-main task-main">
                        <Link
                          to={`/tasks/projects/${project.id}`}
                          className="list-row-title project-link"
                        >
                          {project.name}
                        </Link>
                        <span className="list-row-sub">{project.status.replace('_', ' ')}</span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => setProjectGoal(project.id, null)}
                      >
                        Unlink
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="task-controls">
              <select
                className="inline-select"
                value=""
                onChange={(e) => e.target.value && setProjectGoal(e.target.value, goal.id)}
              >
                <option value="">link an existing project…</option>
                {freeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <form className="field-row" onSubmit={(e) => createProjectForGoal(e, goal)}>
              <input
                type="text"
                value={draftFor(goal.id, 'project', '')}
                onChange={(e) => setDraft(goal.id, 'project', e.target.value)}
                placeholder="or start a new project for this goal"
              />
              <button type="submit" className="btn-secondary">
                Create project
              </button>
            </form>

            <h3>Habits</h3>
            <p className="list-row-sub">
              The daily behaviour behind this goal. Ticked on the Daily tab as usual;
              consistency shows up on the scoreboard.
            </p>

            {goalHabits.length === 0 ? (
              <p className="empty-text">No habits linked.</p>
            ) : (
              <ul className="list">
                {goalHabits.map((habit) => (
                  <li key={habit.id} className={`list-row${habit.active ? '' : ' task-done'}`}>
                    <div className="task-row-body">
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">
                          {habit.icon ? `${habit.icon} ` : ''}
                          {habit.name}
                        </span>
                        <span className="list-row-sub">
                          {habit.slot === 'any' ? 'any time' : habit.slot.toUpperCase()}
                          {habit.active ? '' : ' · archived'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => setHabitGoal(habit.id, null)}
                      >
                        Unlink
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="task-controls">
              <select
                className="inline-select"
                value=""
                onChange={(e) => e.target.value && setHabitGoal(e.target.value, goal.id)}
              >
                <option value="">link an existing habit…</option>
                {freeHabits.map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    {habit.icon ? `${habit.icon} ` : ''}
                    {habit.name}
                  </option>
                ))}
              </select>
            </div>

            <form className="field-row" onSubmit={(e) => createHabitForGoal(e, goal)}>
              <input
                type="text"
                value={draftFor(goal.id, 'habit', '')}
                onChange={(e) => setDraft(goal.id, 'habit', e.target.value)}
                placeholder="or start a new habit for this goal"
              />
              <button type="submit" className="btn-secondary">
                Create habit
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
