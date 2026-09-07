import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO } from './lib/taskDates'
import {
  DEFAULT_MINUTES,
  readFocus,
  onFocusChange,
  startFocus,
  pauseFocus,
  resumeFocus,
  clearFocus,
  remainingMs,
  formatClock,
} from './lib/focus'

const LENGTHS = [25, 50, 90]

function FocusTimer() {
  const [params] = useSearchParams()
  const [state, setState] = useState(readFocus)
  const [, setTick] = useState(0)
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  const [label, setLabel] = useState(params.get('label') || '')
  const [taskId, setTaskId] = useState(params.get('task') || '')
  const [tasks, setTasks] = useState([])
  const [today, setToday] = useState([])

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title')
      .neq('status', 'done')
      .order('due_date', { nullsFirst: false })
      .limit(50)

    if (error) {
      report('Failed to load tasks', error)
      return
    }

    setTasks(data)
  }, [])

  const loadToday = useCallback(async () => {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('session_date', todayISO())
      .order('started_at', { ascending: false })

    if (error) {
      report('Failed to load focus sessions', error)
      return
    }

    setToday(data)
  }, [])

  useEffect(() => {
    loadTasks()
    loadToday()
  }, [loadTasks, loadToday])

  useEffect(() => onFocusChange(setState), [])

  // One tick a second while something is running.
  useEffect(() => {
    if (!state) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  const left = remainingMs(state)
  const done = state && left === 0

  async function logSession(completed) {
    if (!state) return

    const elapsed = Math.round((Date.now() - state.startedAt) / 60000)

    const { error } = await supabase.from('focus_sessions').insert({
      task_id: state.taskId || null,
      label: state.label || null,
      planned_min: state.minutes,
      actual_min: Math.min(elapsed, state.minutes),
      completed,
      started_at: new Date(state.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      session_date: todayISO(),
    })

    if (error) report('Failed to log focus session', error)

    clearFocus()
    loadToday()
  }

  const totalToday = today.reduce((sum, row) => sum + row.actual_min, 0)

  return (
    <section className="focus-module">
      <div className="home-greeting">
        <h1>Focus</h1>
        <p className="list-row-sub">One block. Nothing else.</p>
      </div>

      {state ? (
        <div className={`card focus-card${done ? ' focus-done' : ''}`}>
          <p className="focus-clock">{formatClock(left)}</p>
          <p className="focus-label">
            {state.label || tasks.find((task) => task.id === state.taskId)?.title || 'Focus block'}
          </p>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${100 - (left / (state.minutes * 60000)) * 100}%` }}
            />
          </div>

          {done ? (
            <div className="focus-actions">
              <p className="list-row-sub">Block finished. {state.minutes} minutes in.</p>
              <button type="button" onClick={() => logSession(true)}>
                Log it
              </button>
              <button type="button" className="row-action-btn" onClick={clearFocus}>
                Discard
              </button>
            </div>
          ) : (
            <div className="focus-actions">
              {state.pausedLeft === null ? (
                <button type="button" className="btn-secondary" onClick={() => pauseFocus(state)}>
                  Pause
                </button>
              ) : (
                <button type="button" onClick={() => resumeFocus(state)}>
                  Resume
                </button>
              )}
              <button type="button" className="row-action-btn" onClick={() => logSession(false)}>
                Stop and log
              </button>
              <button type="button" className="row-action-btn row-action-btn-danger" onClick={clearFocus}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="focus-lengths">
            {LENGTHS.map((length) => (
              <button
                key={length}
                type="button"
                className={`view-tab${minutes === length ? ' active' : ''}`}
                onClick={() => setMinutes(length)}
              >
                {length} min
              </button>
            ))}
          </div>

          <input
            type="text"
            className="quick-add-title focus-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What are you working on?"
          />

          <select
            className="focus-input"
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value)
              const task = tasks.find((row) => row.id === e.target.value)
              if (task && !label) setLabel(task.title)
            }}
          >
            <option value="">No task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => startFocus({ minutes, label, taskId: taskId || null })}
          >
            Start {minutes} minutes
          </button>
        </div>
      )}

      <div className="card">
        <div className="project-scope-header">
          <h2>Today</h2>
          <span className="money">{totalToday} min</span>
        </div>

        {today.length === 0 ? (
          <p className="empty-text">No focus blocks logged today.</p>
        ) : (
          <ul className="list">
            {today.map((session) => (
              <li key={session.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{session.label || 'Focus block'}</span>
                  <span className="list-row-sub">
                    {session.actual_min} of {session.planned_min} min
                    {session.completed ? '' : ' · stopped early'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="list-row-sub">
          <Link to="/planning" className="project-link">
            Back to the planner
          </Link>
        </p>
      </div>
    </section>
  )
}

export default FocusTimer
