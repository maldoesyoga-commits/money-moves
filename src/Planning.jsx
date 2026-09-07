import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { todayISO, formatDueDate } from './lib/taskDates'
import {
  HORIZONS,
  periodRange,
  shiftPeriod,
  periodLabel,
  isCurrentPeriod,
} from './lib/planPeriods'
import { formatMoney } from './lib/format'

function Planning() {
  const [horizon, setHorizon] = useState('week')
  const [anchor, setAnchor] = useState(todayISO())

  const [entries, setEntries] = useState([])
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [funds, setFunds] = useState([])
  const [fundBalances, setFundBalances] = useState({})

  const [entryTitle, setEntryTitle] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDate, setGoalDate] = useState('')

  const { start, end } = useMemo(() => periodRange(horizon, anchor), [horizon, anchor])

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('plan_entries')
      .select('*')
      .eq('horizon', horizon)
      .gte('start_date', start)
      .lte('start_date', end)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load plan entries', error.message)
      return
    }

    setEntries(data)
  }, [horizon, start, end])

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .gte('due_date', start)
      .lte('due_date', end)
      .order('due_date')

    if (error) {
      console.log('Failed to load tasks for period', error.message)
      return
    }

    setTasks(data)
  }, [start, end])

  const loadGoals = useCallback(async () => {
    const { data, error } = await supabase.from('goals').select('*').order('target_date')

    if (error) {
      console.log('Failed to load goals', error.message)
      return
    }

    setGoals(data)
  }, [])

  const loadFunds = useCallback(async () => {
    const { data, error } = await supabase.from('savings_funds').select('*')

    if (error) {
      console.log('Failed to load savings funds', error.message)
      return
    }

    setFunds(data)

    const { data: entryRows, error: entryError } = await supabase
      .from('fund_entries')
      .select('fund_id, amount, direction')

    if (entryError) {
      console.log('Failed to load fund entries', entryError.message)
      return
    }

    const balances = {}
    entryRows.forEach((row) => {
      const delta = row.direction === 'in' ? Number(row.amount) : -Number(row.amount)
      balances[row.fund_id] = (balances[row.fund_id] || 0) + delta
    })

    setFundBalances(balances)
  }, [])

  useEffect(() => {
    loadEntries()
    loadTasks()
  }, [loadEntries, loadTasks])

  useEffect(() => {
    loadGoals()
    loadFunds()
  }, [loadGoals, loadFunds])

  async function handleAddEntry(e) {
    e.preventDefault()

    const trimmed = entryTitle.trim()
    if (!trimmed) return

    const { error } = await supabase.from('plan_entries').insert({
      horizon,
      start_date: start,
      end_date: end,
      title: trimmed,
      sort_order: entries.length,
    })

    if (error) {
      console.log('Failed to add plan entry', error.message)
      return
    }

    setEntryTitle('')
    loadEntries()
  }

  async function toggleEntry(entry) {
    const done = !entry.done
    setEntries((prev) => prev.map((row) => (row.id === entry.id ? { ...row, done } : row)))

    const { error } = await supabase.from('plan_entries').update({ done }).eq('id', entry.id)

    if (error) {
      console.log('Failed to update plan entry', error.message)
      loadEntries()
    }
  }

  async function deleteEntry(id) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))

    const { error } = await supabase.from('plan_entries').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete plan entry', error.message)
      loadEntries()
    }
  }

  async function toggleTask(task) {
    const done = task.status !== 'done'
    setTasks((prev) =>
      prev.map((row) => (row.id === task.id ? { ...row, status: done ? 'done' : 'todo' } : row)),
    )

    const { error } = await supabase
      .from('tasks')
      .update({
        status: done ? 'done' : 'todo',
        done_at: done ? new Date().toISOString() : null,
      })
      .eq('id', task.id)

    if (error) {
      console.log('Failed to update task', error.message)
      loadTasks()
    }
  }

  async function handleAddGoal(e) {
    e.preventDefault()

    const trimmed = goalTitle.trim()
    if (!trimmed) return

    const goalHorizon = horizon === 'day' || horizon === 'week' ? 'month' : horizon
    const payload = { title: trimmed, horizon: goalHorizon, target_date: goalDate || end }

    const { error } = await supabase.from('goals').insert(payload)

    if (error) {
      console.log('Failed to add goal', error.message)
      return
    }

    setGoalTitle('')
    setGoalDate('')
    loadGoals()
  }

  async function updateGoal(id, patch) {
    setGoals((prev) => prev.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)))

    const { error } = await supabase.from('goals').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update goal', error.message)
      loadGoals()
    }
  }

  async function deleteGoal(id) {
    setGoals((prev) => prev.filter((goal) => goal.id !== id))

    const { error } = await supabase.from('goals').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete goal', error.message)
      loadGoals()
    }
  }

  const periodGoals = goals.filter(
    (goal) => goal.status !== 'parked' && goal.target_date && goal.target_date >= start && goal.target_date <= end,
  )

  const openTasks = tasks.filter((task) => task.status !== 'done')
  const doneTasks = tasks.filter((task) => task.status === 'done')
  const targetFunds = funds.filter((fund) => fund.target)

  return (
    <section className="planning-module">
      <div className="home-greeting">
        <h1>Planning</h1>
        <p className="list-row-sub">Zoom in on a day, or out to the whole year.</p>
      </div>

      <nav className="segmented-nav">
        {HORIZONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`segmented-tab${horizon === key ? ' active' : ''}`}
            onClick={() => setHorizon(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod(horizon, anchor, -1))}
          aria-label="Previous period"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{periodLabel(horizon, anchor)}</span>
          {!isCurrentPeriod(horizon, anchor) && (
            <button type="button" className="period-today-link" onClick={() => setAnchor(todayISO())}>
              Back to today
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod(horizon, anchor, 1))}
          aria-label="Next period"
        >
          ›
        </button>
      </div>

      <div className="card">
        <h2>Plan</h2>
        <p className="list-row-sub">What this {horizon} is for.</p>

        <form className="quick-add" onSubmit={handleAddEntry}>
          <input
            type="text"
            className="quick-add-title"
            value={entryTitle}
            onChange={(e) => setEntryTitle(e.target.value)}
            placeholder={`Add an intention for this ${horizon}`}
          />
          <button type="submit">Add</button>
        </form>

        {entries.length === 0 ? (
          <p className="empty-text">Nothing planned yet.</p>
        ) : (
          <ul className="list">
            {entries.map((entry) => (
              <li key={entry.id} className={`list-row task-row${entry.done ? ' task-done' : ''}`}>
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`task-check${entry.done ? ' checked' : ''}`}
                    onClick={() => toggleEntry(entry)}
                    aria-label={entry.done ? 'Mark as not done' : 'Mark as done'}
                  >
                    {entry.done ? '✓' : ''}
                  </button>
                  <div className="list-row-main task-main">
                    <span className="list-row-title task-title">{entry.title}</span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Tasks due</h2>
          <Link to="/tasks" className="row-action-btn">
            Open Tasks
          </Link>
        </div>

        {tasks.length === 0 ? (
          <p className="empty-text">Nothing due in this stretch.</p>
        ) : (
          <ul className="list">
            {[...openTasks, ...doneTasks].map((task) => {
              const done = task.status === 'done'
              return (
                <li key={task.id} className={`list-row task-row${done ? ' task-done' : ''}`}>
                  <div className="task-row-body">
                    <button
                      type="button"
                      className={`task-check${done ? ' checked' : ''}`}
                      onClick={() => toggleTask(task)}
                      aria-label={done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {done ? '✓' : ''}
                    </button>
                    <div className="list-row-main task-main">
                      <span className="list-row-title task-title">{task.title}</span>
                      <span className="list-row-sub">{formatDueDate(task.due_date)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Goals landing here</h2>

        <form onSubmit={handleAddGoal}>
          <div className="field-row">
            <input
              type="text"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="goal"
            />
            <input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
            <button type="submit">Add goal</button>
          </div>
        </form>

        {periodGoals.length === 0 ? (
          <p className="empty-text">No goals land in this period.</p>
        ) : (
          <ul className="list">
            {periodGoals.map((goal) => (
              <li key={goal.id} className="list-row project-row">
                <div className="task-row-body">
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{goal.title}</span>
                    <span className="list-row-sub">
                      {goal.horizon} · target {formatDueDate(goal.target_date)}
                    </span>
                  </div>
                  <span className="money">{goal.progress}%</span>
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => deleteGoal(goal.id)}
                  >
                    Delete
                  </button>
                </div>
                <div className="goal-progress-row">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${goal.progress}%` }} />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={goal.progress}
                    onChange={(e) => updateGoal(goal.id, { progress: Number(e.target.value) })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Savings goals</h2>
          <Link to="/money/savings" className="row-action-btn">
            Open Savings
          </Link>
        </div>

        {targetFunds.length === 0 ? (
          <p className="empty-text">No savings funds with a target yet.</p>
        ) : (
          <ul className="list">
            {targetFunds.map((fund) => {
              const balance = fundBalances[fund.id] || 0
              const pct = Math.min(100, Math.max(0, Math.round((balance / Number(fund.target)) * 100)))

              return (
                <li key={fund.id} className="list-row project-row">
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title">{fund.name}</span>
                      <span className="list-row-sub">
                        {formatMoney(balance)} of {formatMoney(fund.target)} ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Planning
