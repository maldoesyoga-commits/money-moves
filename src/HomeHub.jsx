import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import TodayStrip from './TodayStrip'
import { BarChart, HBar, Meter } from './Charts'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'
import { weekNumberFor, plannedFor, executionScore, TARGET_SCORE } from './lib/twelveWeek'
import { nextDue, daysUntil } from './lib/household'

const MODULES = [
  { key: 'money', icon: '💰', name: 'Money Moves', path: '/money' },
  { key: 'tasks', icon: '✅', name: 'Tasks & Projects', path: '/tasks' },
  { key: 'daily', icon: '🌅', name: 'Daily', path: '/daily' },
  { key: 'notes', icon: '📝', name: 'Notes', path: '/notes' },
  { key: 'goals', icon: '🎯', name: 'Goals', path: '/goals' },
  { key: 'planning', icon: '🗓️', name: 'Planning', path: '/planning' },
  { key: 'learning', icon: '📚', name: 'Learning', path: '/learning' },
  { key: 'content', icon: '🎬', name: 'Content', path: '/content' },
  { key: 'brand', icon: '🎨', name: 'Brand', path: '/brand' },
  { key: 'freelance', icon: '💼', name: 'Freelance', path: '/freelance' },
  { key: 'cookie-jar', icon: '🍪', name: 'Cookie Jar', path: '/cookie-jar' },
  { key: 'milestones', icon: '🏔️', name: 'Milestones', path: '/milestones' },
  { key: 'household', icon: '🏠', name: 'Household', path: '/household' },
]

const STAGES = ['idea', 'scripted', 'filmed', 'edited', 'posted']

// Every read is best-effort — a module whose SQL hasn't been run yet
// contributes nothing rather than breaking the dashboard.
async function safeSelect(table, build = (q) => q) {
  const { data, error } = await build(supabase.from(table).select('*'))

  if (error) {
    console.log(`Dashboard skipped ${table}`, error.message)
    return []
  }

  return data || []
}

function shift(iso, days) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// Monday-anchored week starts, oldest first.
function lastWeeks(count, from = todayISO()) {
  const base = new Date(`${from}T12:00:00`)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7))

  return Array.from({ length: count }, (_, i) => {
    const start = new Date(base)
    start.setDate(base.getDate() - (count - 1 - i) * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      short: start.toLocaleDateString(undefined, { day: 'numeric' }),
    }
  })
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

function HomeHub() {
  const [data, setData] = useState(null)

  const today = todayISO()

  const load = useCallback(async () => {
    const eightWeeksAgo = shift(today, -56)

    const [tasks, content, habits, habitLogs, cycles, jar, milestones, upkeep] =
      await Promise.all([
        safeSelect('tasks'),
        safeSelect('content_items'),
        safeSelect('habits'),
        safeSelect('habit_logs', (q) => q.gte('log_date', shift(today, -13))),
        safeSelect('twy_cycles', (q) => q.in('status', ['planning', 'active'])),
        safeSelect('cookie_jar'),
        safeSelect('milestones'),
        safeSelect('household_maintenance', (q) => q.eq('active', true)),
      ])

    const cycle = cycles[0] || null
    let goals = []
    let tactics = []
    let logs = []

    if (cycle) {
      goals = await safeSelect('twy_goals', (q) => q.eq('cycle_id', cycle.id))
      if (goals.length > 0) {
        tactics = await safeSelect('twy_tactics', (q) =>
          q.in('goal_id', goals.map((goal) => goal.id)),
        )
        logs = await safeSelect('twy_tactic_logs')
      }
    }

    setData({
      tasks,
      content,
      habits,
      habitLogs,
      cycle,
      goals,
      tactics,
      logs,
      jar,
      milestones,
      upkeep,
      eightWeeksAgo,
    })
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  if (!data) {
    return (
      <section className="home-hub">
        <div className="home-greeting">
          <h1>Homestead</h1>
          <p className="list-row-sub">Loading…</p>
        </div>
      </section>
    )
  }

  const {
    tasks,
    content,
    habits,
    habitLogs,
    cycle,
    tactics,
    logs,
    jar,
    milestones,
    upkeep,
  } = data

  // --- the numbers ----------------------------------------------------------

  const openTasks = tasks.filter((task) => task.status !== 'done')
  const dueToday = openTasks.filter((task) => task.due_date && task.due_date <= today)
  const overdue = openTasks.filter((task) => isOverdue(task.due_date))
  const doingNow = openTasks.filter((task) => task.status === 'doing')

  const week = cycle ? weekNumberFor(cycle.start_date) : null
  const dueThisWeek = tactics.filter((tactic) => plannedFor(tactic, week) > 0)
  const score = week && week > 0 ? executionScore(dueThisWeek, logs, week) : null

  const weeks = lastWeeks(8)
  const finishedByWeek = weeks.map((row) => ({
    label: row.label,
    short: row.short,
    value: tasks.filter(
      (task) =>
        task.status === 'done' &&
        task.done_at &&
        task.done_at.slice(0, 10) >= row.start &&
        task.done_at.slice(0, 10) <= row.end,
    ).length,
  }))

  const pipeline = STAGES.map((stage) => ({
    label: stage[0].toUpperCase() + stage.slice(1),
    value: content.filter((item) => item.stage === stage).length,
  })).filter((row) => row.value > 0)

  const activeHabits = habits.filter((habit) => habit.active)
  const habitDays = Array.from({ length: 14 }, (_, i) => shift(today, -13 + i))
  const habitSeries = habitDays.map((day) => ({
    label: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
    }),
    short: new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric' }),
    value: habitLogs.filter((log) => log.log_date === day).length,
  }))
  const habitPossible = activeHabits.length * 14
  const habitHits = habitSeries.reduce((sum, row) => sum + row.value, 0)

  const upcomingContent = content
    .filter(
      (item) =>
        item.stage !== 'posted' &&
        item.publish_date &&
        item.publish_date >= today &&
        item.publish_date <= shift(today, 7),
    )
    .sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1))

  // Upkeep that is due now or inside the next fortnight.
  const upkeepDue = upkeep.filter((job) => daysUntil(nextDue(job)) <= 14).length

  const nextMilestone = milestones
    .filter((row) => !row.achieved && row.target_date)
    .sort((a, b) => (a.target_date < b.target_date ? -1 : 1))[0]

  const jarThisYear = jar.filter((row) =>
    (row.moment_on || '').startsWith(String(new Date().getFullYear())),
  ).length

  return (
    <section className="home-hub">
      <div className="home-greeting">
        <h1>{greeting()}, Mal</h1>
        <p className="list-row-sub">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          {cycle && week > 0 ? ` · week ${week} of the ${cycle.title} cycle` : null}
        </p>
      </div>

      <TodayStrip />

      <div className="review-grid dash-stats">
        <Link to="/tasks" className="review-stat dash-stat-link">
          <span className="review-stat-value">{dueToday.length}</span>
          <span className="review-stat-label">Due today</span>
          {overdue.length > 0 && (
            <span className="review-stat-sub task-overdue">{overdue.length} overdue</span>
          )}
        </Link>

        <Link to="/goals" className="review-stat dash-stat-link">
          <span className={`review-stat-value${score !== null && score >= TARGET_SCORE ? ' score-good' : ''}`}>
            {score === null ? '—' : `${score}%`}
          </span>
          <span className="review-stat-label">Execution</span>
          <span className="review-stat-sub">{TARGET_SCORE}% is the line</span>
        </Link>

        <Link to="/content" className="review-stat dash-stat-link">
          <span className="review-stat-value">{upcomingContent.length}</span>
          <span className="review-stat-label">Content this week</span>
        </Link>

        <Link to="/cookie-jar" className="review-stat dash-stat-link">
          <span className="review-stat-value">{jar.length}</span>
          <span className="review-stat-label">In the jar</span>
          {jarThisYear > 0 && <span className="review-stat-sub">{jarThisYear} this year</span>}
        </Link>
      </div>

      <div className="dash-charts">
        <BarChart
          title="Tasks finished"
          caption="last 8 weeks"
          data={finishedByWeek}
          color="var(--chart-1)"
        />

        <BarChart
          title="Habits kept"
          caption={
            habitPossible > 0
              ? `${Math.round((habitHits / habitPossible) * 100)}% of the last 14 days`
              : 'last 14 days'
          }
          data={habitSeries}
          color="var(--chart-3)"
        />
      </div>

      {pipeline.length > 0 && (
        <HBar
          title="Content pipeline"
          caption={`${content.filter((item) => item.stage === 'posted').length} of ${content.length} posted`}
          data={pipeline}
          color="var(--chart-2)"
          to={
            <p className="list-row-sub">
              <Link to="/content" className="project-link">
                Open the pipeline
              </Link>
            </p>
          }
        />
      )}

      {(dueToday.length > 0 || doingNow.length > 0) && (
        <div className="card">
          <div className="project-scope-header">
            <h3>On today</h3>
            <Link to="/tasks" className="row-action-btn">
              All tasks
            </Link>
          </div>
          <ul className="list">
            {[...doingNow, ...dueToday.filter((task) => task.status !== 'doing')]
              .slice(0, 6)
              .map((task) => (
                <li key={task.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{task.title}</span>
                    <span className="list-row-sub task-meta">
                      <span className={isOverdue(task.due_date) ? 'task-overdue' : undefined}>
                        {formatDueDate(task.due_date)}
                      </span>
                      {task.status === 'doing' && <span>in progress</span>}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {upcomingContent.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h3>Going out this week</h3>
            <Link to="/content" className="row-action-btn">
              Content
            </Link>
          </div>
          <ul className="list">
            {upcomingContent.slice(0, 6).map((item) => (
              <li key={item.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{item.title}</span>
                  <span className="list-row-sub task-meta">
                    <span>{formatDueDate(item.publish_date)}</span>
                    <span>{item.platform}</span>
                    <span>{item.stage}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(nextMilestone || upkeepDue > 0) && (
        <div className="card">
          <h3>Worth knowing</h3>
          <ul className="list">
            {nextMilestone && (
              <li className="list-row">
                <div className="list-row-main">
                  <Link to="/milestones" className="list-row-title project-link">
                    🏔️ {nextMilestone.title}
                  </Link>
                  <span className="list-row-sub">
                    next milestone · {formatDueDate(nextMilestone.target_date)}
                  </span>
                </div>
              </li>
            )}
            {upkeepDue > 0 && (
              <li className="list-row">
                <div className="list-row-main">
                  <Link to="/household" className="list-row-title project-link">
                    🏠 {upkeepDue} upkeep {upkeepDue === 1 ? 'job' : 'jobs'} on the schedule
                  </Link>
                  <span className="list-row-sub">household</span>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}

      {activeHabits.length > 0 && (
        <div className="card">
          <h3>Today&apos;s habits</h3>
          <div className="meter-stack">
            {activeHabits.slice(0, 6).map((habit) => {
              const hits = habitLogs.filter((log) => log.habit_id === habit.id).length

              return (
                <Meter
                  key={habit.id}
                  label={`${habit.icon ? `${habit.icon} ` : ''}${habit.name}`}
                  value={hits}
                  max={14}
                  caption={`${hits} of the last 14 days`}
                  tone="var(--chart-1)"
                  target={Math.round((11 / 14) * 100)}
                />
              )
            })}
          </div>
          <p className="list-row-sub">
            The notch is 11 of 14 — roughly the &ldquo;most days&rdquo; line.{' '}
            <Link to="/daily" className="project-link">
              Daily
            </Link>
          </p>
        </div>
      )}

      <div className="card">
        <h3>Everything else</h3>
        <div className="module-grid module-grid-compact">
          {MODULES.map((mod) => (
            <Link key={mod.key} to={mod.path} className="module-card">
              <span className="module-card-icon">{mod.icon}</span>
              <span className="module-card-name">{mod.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <p className="hub-footer">
        <Link to="/review" className="project-link">
          Weekly review
        </Link>
        {' · '}
        <Link to="/search" className="project-link">
          Search
        </Link>
        {' · '}
        <Link to="/tags" className="project-link">
          Tags
        </Link>
        {' · '}
        <Link to="/backup" className="project-link">
          Back up my data
        </Link>
      </p>
    </section>
  )
}

export default HomeHub
