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

function TimeLog() {
  const [entries, setEntries] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [range, setRange] = useState('week')

  const [entryDate, setEntryDate] = useState(todayISO())
  const [duration, setDuration] = useState('')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')

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
    const { data: clientRows, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    if (clientError) {
      report('Failed to load clients', clientError)
      return
    }

    const { data: projectRows, error: projectError } = await supabase
      .from('freelance_projects')
      .select('*')
      .order('name')

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

  async function handleAdd(e) {
    e.preventDefault()

    const minutes = parseDuration(duration)
    if (!minutes) return

    const project = projectFor(projectId)
    const payload = { entry_date: entryDate, minutes }
    if (projectId) payload.project_id = projectId
    if (project?.client_id) payload.client_id = project.client_id
    if (notes.trim()) payload.notes = notes.trim()

    const { error } = await supabase.from('time_entries').insert(payload)

    if (error) {
      report('Failed to add time entry', error)
      return
    }

    setDuration('')
    setNotes('')
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

  return (
    <div className="card">
      <h2>Time</h2>

      <form onSubmit={handleAdd}>
        <div className="field-row">
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="1.5  ·  90m  ·  1h30"
          />
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field-row">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="what you worked on"
          />
          <button type="submit">Log time</button>
        </div>
      </form>

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

            return (
              <li key={entry.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{entry.notes || project?.name || 'Time'}</span>
                  <span className="list-row-sub task-meta">
                    <span>{entry.entry_date}</span>
                    <span>{formatHours(entry.minutes)}</span>
                    {project && <span>{project.name}</span>}
                    {entry.invoice_id && <span className="priority-pill">Invoiced</span>}
                    {!entry.billable && <span className="priority-pill">Non-billable</span>}
                  </span>
                </div>
                {value !== null && <span className="money">{formatMoney(value)}</span>}
                <div className="stage-nudge">
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => updateEntry(entry.id, { billable: !entry.billable })}
                  >
                    {entry.billable ? 'Mark non-billable' : 'Mark billable'}
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
  )
}

export default TimeLog
