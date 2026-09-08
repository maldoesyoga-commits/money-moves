import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { formatHours, parseDuration } from './lib/freelance'
import { todayISO } from './lib/taskDates'
import { report } from './lib/report'

const RANGES = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'unbilled', label: 'Unbilled' },
  { key: 'all', label: 'All' },
]

function startOfWeekISO() {
  const date = new Date(`${todayISO()}T12:00:00`)
  const weekday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - weekday)
  return date.toISOString().slice(0, 10)
}

function startOfMonthISO() {
  return `${todayISO().slice(0, 7)}-01`
}

function clockTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// The elapsed time of a running session, as h:mm:ss.
function elapsedText(startedAt, now) {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function minutesBetween(startedAt, endedAt) {
  return Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000))
}

// A session is a row with a start and an end. While it is running it has a
// start and no end — that IS the timer, so there is no separate state to fall
// out of sync with the log.
function TimeLog() {
  const [entries, setEntries] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [range, setRange] = useState('week')
  const [now, setNow] = useState(Date.now())

  // Which entry mode is showing: the live timer, or a past session by hand.
  const [mode, setMode] = useState('now')

  // Live-timer box.
  const [notes, setNotes] = useState('')
  const [projectId, setProjectId] = useState('')

  // Past-session box — fully self-contained, its own fields.
  const [pastDate, setPastDate] = useState(todayISO())
  const [pastDuration, setPastDuration] = useState('')
  const [pastNotes, setPastNotes] = useState('')
  const [pastProjectId, setPastProjectId] = useState('')
  const [pastClientId, setPastClientId] = useState('')
  const [pastBillable, setPastBillable] = useState(true)

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      report('Failed to load time entries', error)
      return
    }

    setEntries(data)
  }, [])

  const loadRefs = useCallback(async () => {
    const [{ data: clientRows, error: clientError }, { data: projectRows, error: projectError }] =
      await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('freelance_projects').select('*').order('name'),
      ])

    if (clientError) {
      report('Failed to load clients', clientError)
      return
    }

    if (projectError) {
      report('Failed to load freelance projects', projectError)
      return
    }

    setClients(clientRows)
    setProjects(projectRows)
  }, [])

  useEffect(() => {
    loadEntries()
    loadRefs()
  }, [loadEntries, loadRefs])

  const running = entries.find((entry) => entry.started_at && !entry.ended_at) || null

  // Only tick while something is actually running.
  useEffect(() => {
    if (!running) return undefined

    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])

  function projectFor(id) {
    return projects.find((project) => project.id === id)
  }

  function clientFor(id) {
    return clients.find((client) => client.id === id)
  }

  function rateFor(entry) {
    const project = projectFor(entry.project_id)
    return project?.rate || clientFor(entry.client_id || project?.client_id)?.rate || null
  }

  async function startTimer() {
    if (running) return

    const project = projectFor(projectId)
    const payload = {
      entry_date: todayISO(),
      minutes: 0,
      started_at: new Date().toISOString(),
    }
    if (projectId) payload.project_id = projectId
    if (project?.client_id) payload.client_id = project.client_id
    if (notes.trim()) payload.notes = notes.trim()

    const { error } = await supabase.from('time_entries').insert(payload)

    if (error) {
      report('Failed to start the timer', error)
      return
    }

    setNow(Date.now())
    loadEntries()
  }

  async function stopTimer() {
    if (!running) return

    const ended = new Date().toISOString()
    const patch = {
      ended_at: ended,
      minutes: minutesBetween(running.started_at, ended),
    }

    // Anything typed into the box while it ran becomes the session note.
    if (notes.trim() && !running.notes) patch.notes = notes.trim()

    const { error } = await supabase.from('time_entries').update(patch).eq('id', running.id)

    if (error) {
      report('Failed to stop the timer', error)
      return
    }

    setNotes('')
    loadEntries()
  }

  async function handleAddPast(e) {
    e.preventDefault()

    const minutes = parseDuration(pastDuration)
    if (!minutes) return

    const project = projectFor(pastProjectId)
    const payload = {
      entry_date: pastDate,
      minutes,
      billable: pastBillable,
    }
    if (pastProjectId) payload.project_id = pastProjectId
    // An explicit client wins; otherwise inherit the project's client.
    const clientId = pastClientId || project?.client_id || null
    if (clientId) payload.client_id = clientId
    if (pastNotes.trim()) payload.notes = pastNotes.trim()

    const { error } = await supabase.from('time_entries').insert(payload)

    if (error) {
      report('Failed to add time entry', error)
      return
    }

    setPastDuration('')
    setPastNotes('')
    setPastProjectId('')
    setPastClientId('')
    setPastBillable(true)
    setPastDate(todayISO())
    loadEntries()
  }

  async function updateEntry(id, patch) {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))

    const { error } = await supabase.from('time_entries').update(patch).eq('id', id)

    if (error) {
      report('Failed to update time entry', error)
      loadEntries()
    }
  }

  // Editing a start or end time re-derives the duration from the two of them.
  async function editStamp(entry, field, value) {
    if (!value) return

    const iso = new Date(`${entry.entry_date}T${value}`).toISOString()
    const patch = { [field]: iso }

    const startedAt = field === 'started_at' ? iso : entry.started_at
    const endedAt = field === 'ended_at' ? iso : entry.ended_at

    if (startedAt && endedAt) patch.minutes = minutesBetween(startedAt, endedAt)

    updateEntry(entry.id, patch)
  }

  async function deleteEntry(id) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))

    const { error } = await supabase.from('time_entries').delete().eq('id', id)

    if (error) {
      report('Failed to delete time entry', error)
      loadEntries()
    }
  }

  const visible = useMemo(() => {
    if (range === 'all') return entries
    if (range === 'unbilled') return entries.filter((entry) => entry.billable && !entry.invoice_id)
    const from = range === 'week' ? startOfWeekISO() : startOfMonthISO()
    return entries.filter((entry) => entry.entry_date >= from)
  }, [entries, range])

  const totalMinutes = visible.reduce((sum, entry) => sum + entry.minutes, 0)
  const totalValue = visible.reduce((sum, entry) => {
    if (!entry.billable) return sum
    const rate = rateFor(entry)
    return rate ? sum + (entry.minutes / 60) * Number(rate) : sum
  }, 0)

  function timeValue(iso) {
    if (!iso) return ''
    const date = new Date(iso)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // A running timer belongs to the live view — keep it visible there so it can
  // always be stopped, whichever mode was last chosen.
  const showNow = mode === 'now' || Boolean(running)

  return (
    <>
      <div className="card">
        <nav className="segmented-nav">
          <button
            type="button"
            className={`segmented-tab${mode === 'now' ? ' active' : ''}`}
            onClick={() => setMode('now')}
          >
            Log now
          </button>
          <button
            type="button"
            className={`segmented-tab${mode === 'past' ? ' active' : ''}`}
            onClick={() => setMode('past')}
          >
            Log a past session
          </button>
        </nav>

        {showNow ? (
          <div className="timer-panel">
            <div className="project-scope-header">
              <h2>Timer</h2>
              {running && (
                <span className="list-row-sub">started {clockTime(running.started_at)}</span>
              )}
            </div>

            <p className={`timer-readout${running ? ' is-running' : ''}`}>
              {running ? elapsedText(running.started_at, now) : '0:00:00'}
            </p>

            {/* What you're doing is the thing you always fill in, so it gets the
                whole width. The project is optional and sits underneath. */}
            <input
              type="text"
              className="quick-add-title"
              value={running ? running.notes || notes : notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="what you're working on"
              disabled={Boolean(running?.notes)}
            />

            <div className="field-row timer-actions">
              {running ? (
                <button type="button" onClick={stopTimer}>
                  End time
                </button>
              ) : (
                <button type="button" onClick={startTimer}>
                  Start time
                </button>
              )}
              <label className="filter-toggle timer-project">
                Project (optional)
                <select
                  className="inline-select"
                  value={running ? running.project_id || '' : projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={Boolean(running)}
                >
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="list-row-sub">
              {running
                ? 'Ending it works out the minutes between start and end and files the session.'
                : 'Start the clock, or switch to “Log a past session” to enter one by hand.'}
            </p>
          </div>
        ) : (
          <div className="past-panel">
            <h2>Log a past session</h2>
            <p className="list-row-sub">Everything for this session lives in this box.</p>

            <form onSubmit={handleAddPast}>
              <input
                type="text"
                value={pastNotes}
                onChange={(e) => setPastNotes(e.target.value)}
                placeholder="what you worked on"
              />

              <div className="field-row">
                <label className="filter-toggle">
                  Date
                  <input
                    type="date"
                    className="inline-select"
                    value={pastDate}
                    onChange={(e) => setPastDate(e.target.value)}
                  />
                </label>
                <input
                  type="text"
                  value={pastDuration}
                  onChange={(e) => setPastDuration(e.target.value)}
                  placeholder="1.5  ·  90m  ·  1h30"
                />
              </div>

              <div className="field-row">
                <select
                  className="inline-select"
                  value={pastProjectId}
                  onChange={(e) => setPastProjectId(e.target.value)}
                >
                  <option value="">Project (optional)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  className="inline-select"
                  value={pastClientId}
                  onChange={(e) => setPastClientId(e.target.value)}
                >
                  <option value="">Client (optional)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <label className="filter-toggle">
                  <input
                    type="checkbox"
                    checked={pastBillable}
                    onChange={(e) => setPastBillable(e.target.checked)}
                  />
                  Billable
                </label>
                <button type="submit">Log time</button>
              </div>
            </form>
            <p className="list-row-sub">
              A project fills in its client and rate automatically; set a client on its own for
              work that isn&apos;t tied to a project.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <nav className="view-tabs">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`view-tab${range === key ? ' active' : ''}`}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="total-row">
          <p>{formatHours(totalMinutes)}</p>
          <span className="money">{formatMoney(totalValue)}</span>
        </div>

        {visible.length === 0 ? (
          <p className="empty-text">No time logged in this stretch.</p>
        ) : (
          <ul className="list">
            {visible.map((entry) => {
              const project = projectFor(entry.project_id)
              const rate = rateFor(entry)
              const value = rate && entry.billable ? (entry.minutes / 60) * Number(rate) : null
              const isRunning = entry.started_at && !entry.ended_at
              const client = clientFor(entry.client_id || project?.client_id)

              return (
                <li key={entry.id} className={`list-row${isRunning ? ' timer-live' : ''}`}>
                  <div className="list-row-main">
                    <span className="list-row-title">
                      {entry.notes || project?.name || 'Time'}
                    </span>
                    <span className="list-row-sub task-meta">
                      <span>{entry.entry_date}</span>
                      {entry.started_at && (
                        <span>
                          {clockTime(entry.started_at)} –{' '}
                          {isRunning ? 'running' : clockTime(entry.ended_at)}
                        </span>
                      )}
                      <span>{isRunning ? elapsedText(entry.started_at, now) : formatHours(entry.minutes)}</span>
                      {project && <span>{project.name}</span>}
                      {!project && client && <span>{client.name}</span>}
                      {entry.invoice_id && <span className="priority-pill">Invoiced</span>}
                      {!entry.billable && <span className="priority-pill">Non-billable</span>}
                    </span>
                  </div>

                  {value !== null && <span className="money">{formatMoney(value)}</span>}

                  <div className="stage-nudge">
                    {entry.started_at && !isRunning && (
                      <>
                        <input
                          type="time"
                          className="target-input"
                          value={timeValue(entry.started_at)}
                          title="Start"
                          onChange={(e) => editStamp(entry, 'started_at', e.target.value)}
                        />
                        <input
                          type="time"
                          className="target-input"
                          value={timeValue(entry.ended_at)}
                          title="End"
                          onChange={(e) => editStamp(entry, 'ended_at', e.target.value)}
                        />
                      </>
                    )}
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => updateEntry(entry.id, { billable: !entry.billable })}
                    >
                      {entry.billable ? 'Non-billable' : 'Billable'}
                    </button>
                    <button
                      type="button"
                      className="row-action-btn row-action-btn-danger"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

export default TimeLog
