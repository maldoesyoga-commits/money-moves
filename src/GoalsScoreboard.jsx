import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import {
  CYCLE_WEEKS,
  TARGET_SCORE,
  weekNumberFor,
  weekLabel,
  plannedFor,
  executionScore,
  scoreTone,
  daysElapsed,
  objectiveProgress,
  projectProgress,
  habitConsistency,
} from './lib/twelveWeek'
import { todayISO } from './lib/taskDates'
import EmptyState from './EmptyState'
import { report } from './lib/report'

function GoalsScoreboard({ cycle }) {
  const [goals, setGoals] = useState([])
  const [tactics, setTactics] = useState([])
  const [logs, setLogs] = useState([])
  const [objectives, setObjectives] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])

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
    if (ids.length === 0) return

    const [
      { data: tacticRows },
      { data: logRows },
      { data: objectiveRows },
      { data: projectRows },
      { data: taskRows },
      { data: habitRows },
      { data: habitLogRows },
    ] = await Promise.all([
      supabase.from('twy_tactics').select('*').in('goal_id', ids),
      supabase.from('twy_tactic_logs').select('*'),
      supabase.from('twy_objectives').select('*').in('goal_id', ids).order('sort_order'),
      supabase.from('projects').select('*').in('twy_goal_id', ids),
      supabase.from('tasks').select('project_id, status'),
      supabase.from('habits').select('*').in('twy_goal_id', ids),
      supabase
        .from('habit_logs')
        .select('habit_id, log_date')
        .gte('log_date', cycle.start_date),
    ])

    setTactics(tacticRows || [])
    setLogs(logRows || [])
    setObjectives(objectiveRows || [])
    setProjects(projectRows || [])
    setTasks(taskRows || [])
    setHabits(habitRows || [])
    setHabitLogs(habitLogRows || [])
  }, [cycle.id, cycle.start_date])

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

  const objectivesDone = objectives.filter((row) => row.done).length
  const elapsed = daysElapsed(cycle.start_date)

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
            {objectives.length ? `${objectivesDone}/${objectives.length}` : '—'}
          </span>
          <span className="review-stat-label">Objectives met</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">
            {currentWeek === null ? 'done' : currentWeek === 0 ? '—' : currentWeek}
          </span>
          <span className="review-stat-label">Current week</span>
          <span className="review-stat-sub">day {elapsed} of 91</span>
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

      {goals.map((goal) => {
        const goalObjectives = objectives.filter((row) => row.goal_id === goal.id)
        const goalProjects = projects.filter((project) => project.twy_goal_id === goal.id)
        const goalHabits = habits.filter((habit) => habit.twy_goal_id === goal.id)
        const goalTactics = tactics.filter((tactic) => tactic.goal_id === goal.id)

        const obj = objectiveProgress(goalObjectives)
        const proj = projectProgress(goalProjects, tasks)
        const habit = habitConsistency(goalHabits, habitLogs, cycle.start_date, todayISO())
        const execution =
          currentWeek && currentWeek > 0 ? executionScore(goalTactics, logs, currentWeek) : null

        const lagPct =
          goal.lag_target && Number(goal.lag_target) > 0
            ? Math.min(
                100,
                Math.round((Number(goal.lag_current) / Number(goal.lag_target)) * 100),
              )
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
              <span className={`list-row-sub ${scoreTone(execution)}`}>
                {execution === null ? '' : `${execution}% this week`}
              </span>
            </div>

            {goal.aim && <p className="list-row-sub">Aim — {goal.aim}</p>}

            <div className="goal-progress-block">
              <div className="budget-row-header">
                <span className="list-row-title">Outcome</span>
                <span className="list-row-sub">
                  {lagPct === null
                    ? goal.lag_measure || 'no lag measure set'
                    : `${goal.lag_current} of ${goal.lag_target} ${goal.lag_unit || ''} (${lagPct}%)`}
                </span>
              </div>
              {lagPct !== null && (
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${lagPct}%`, background: goal.color || 'var(--sage)' }}
                  />
                </div>
              )}
            </div>

            <div className="goal-progress-block">
              <div className="budget-row-header">
                <span className="list-row-title">Objectives</span>
                <span className="list-row-sub">
                  {obj === null ? 'none set' : `${obj.done} of ${obj.total} met`}
                </span>
              </div>
              {obj !== null && (
                <>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${obj.pct}%`, background: goal.color || 'var(--sage)' }}
                    />
                  </div>
                  <ul className="list">
                    {goalObjectives.map((objective) => (
                      <li
                        key={objective.id}
                        className={`list-row${objective.done ? ' task-done' : ''}`}
                      >
                        <div className="list-row-main">
                          <span className="list-row-title">
                            {objective.done ? '✓ ' : '○ '}
                            {objective.title}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="goal-progress-block">
              <div className="budget-row-header">
                <span className="list-row-title">Projects</span>
                <span className="list-row-sub">
                  {proj === null
                    ? 'none linked'
                    : proj.total === 0
                      ? `${proj.projects} linked · no tasks yet`
                      : `${proj.done} of ${proj.total} tasks done`}
                </span>
              </div>
              {proj !== null && proj.pct !== null && (
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${proj.pct}%`, background: goal.color || 'var(--sage)' }}
                  />
                </div>
              )}
              {goalProjects.length > 0 && (
                <ul className="list">
                  {goalProjects.map((project) => {
                    const mine = tasks.filter((task) => task.project_id === project.id)
                    const done = mine.filter((task) => task.status === 'done').length

                    return (
                      <li key={project.id} className="list-row">
                        <div className="list-row-main">
                          <Link
                            to={`/tasks/projects/${project.id}`}
                            className="list-row-title project-link"
                          >
                            {project.name}
                          </Link>
                          <span className="list-row-sub">
                            {done} of {mine.length} done · {project.status.replace('_', ' ')}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="goal-progress-block">
              <div className="budget-row-header">
                <span className="list-row-title">Habits</span>
                <span className="list-row-sub">
                  {habit === null
                    ? 'none linked'
                    : habit.pct === null
                      ? `${habit.habits} linked · cycle hasn't started`
                      : `${habit.pct}% kept · ${habit.hits} of ${habit.possible} chances`}
                </span>
              </div>
              {habit !== null && habit.pct !== null && (
                <div className="progress-track">
                  <div
                    className={`progress-fill ${scoreTone(habit.pct)}`}
                    style={{ width: `${habit.pct}%` }}
                  />
                </div>
              )}
              {goalHabits.length > 0 && (
                <ul className="list">
                  {goalHabits.map((row) => {
                    const hits = habitLogs.filter((log) => log.habit_id === row.id).length

                    return (
                      <li key={row.id} className="list-row">
                        <div className="list-row-main">
                          <span className="list-row-title">
                            {row.icon ? `${row.icon} ` : ''}
                            {row.name}
                          </span>
                          <span className="list-row-sub">
                            {hits} of {elapsed} days this cycle
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default GoalsScoreboard
