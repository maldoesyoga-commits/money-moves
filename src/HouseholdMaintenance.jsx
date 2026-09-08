import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { todayISO, formatDueDate } from './lib/taskDates'
import { INTERVAL_UNITS, nextDue, daysUntil, dueTone, intervalLabel } from './lib/household'
import { report } from './lib/report'

const STARTERS = [
  { title: 'Furnace filter', area: 'HVAC', interval_value: 3, interval_unit: 'months' },
  { title: 'Smoke detector batteries', area: 'Safety', interval_value: 1, interval_unit: 'years' },
  { title: 'Clean dryer vent', area: 'Laundry', interval_value: 6, interval_unit: 'months' },
  { title: 'Gutters', area: 'Outside', interval_value: 6, interval_unit: 'months' },
  { title: 'Descale kettle & coffee maker', area: 'Kitchen', interval_value: 3, interval_unit: 'months' },
]

function HouseholdMaintenance() {
  const [jobs, setJobs] = useState([])
  const [items, setItems] = useState([])
  const [logs, setLogs] = useState([])
  const [openId, setOpenId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const [title, setTitle] = useState('')
  const [value, setValue] = useState(3)
  const [unit, setUnit] = useState('months')

  const load = useCallback(async () => {
    const [{ data: jobRows, error }, { data: itemRows }, { data: logRows }] = await Promise.all([
      supabase.from('household_maintenance').select('*').order('created_at'),
      supabase.from('household_items').select('id, name, location').order('name'),
      supabase
        .from('household_maintenance_logs')
        .select('*')
        .order('done_on', { ascending: false })
        .limit(200),
    ])

    if (error) {
      report('Failed to load maintenance', error)
      return
    }

    setJobs(jobRows || [])
    setItems(itemRows || [])
    setLogs(logRows || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addJob(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const { error } = await supabase.from('household_maintenance').insert({
      title: trimmed,
      interval_value: Math.max(1, Number(value) || 1),
      interval_unit: unit,
    })

    if (error) {
      report('Failed to add job', error)
      return
    }

    setTitle('')
    load()
  }

  async function addStarters() {
    const { error } = await supabase.from('household_maintenance').insert(STARTERS)

    if (error) {
      report('Failed to add starter jobs', error)
      return
    }

    load()
  }

  async function updateJob(id, patch) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)))

    const { error } = await supabase.from('household_maintenance').update(patch).eq('id', id)

    if (error) {
      report('Failed to update job', error)
      load()
    }
  }

  async function deleteJob(id) {
    setJobs((prev) => prev.filter((job) => job.id !== id))

    const { error } = await supabase.from('household_maintenance').delete().eq('id', id)

    if (error) {
      report('Failed to delete job', error)
      load()
    }
  }

  // Marking it done logs the date and moves the next due date along.
  async function markDone(job) {
    const done = todayISO()

    const { error } = await supabase
      .from('household_maintenance_logs')
      .insert({ maintenance_id: job.id, done_on: done })

    if (error) {
      report('Failed to log maintenance', error)
      return
    }

    await updateJob(job.id, { last_done: done })
    load()
  }

  function itemFor(id) {
    return items.find((item) => item.id === id) || null
  }

  const visible = jobs
    .filter((job) => showInactive || job.active)
    .map((job) => ({ ...job, due: nextDue(job) }))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))

  const overdue = visible.filter((job) => daysUntil(job.due) < 0).length
  const soon = visible.filter((job) => {
    const days = daysUntil(job.due)
    return days >= 0 && days <= 30
  }).length

  return (
    <>
      <div className="review-grid">
        <div className="review-stat">
          <span className="review-stat-value">{overdue}</span>
          <span className="review-stat-label">Overdue</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{soon}</span>
          <span className="review-stat-label">Due in 30 days</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{visible.length}</span>
          <span className="review-stat-label">On the schedule</span>
        </div>
      </div>

      <div className="card">
        <h2>Add a job</h2>
        <form onSubmit={addJob}>
          <div className="field-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="what needs doing — e.g. Change furnace filter"
            />
            <input
              type="number"
              min="1"
              max="120"
              className="target-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <select className="inline-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {INTERVAL_UNITS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit">Add</button>
          </div>
        </form>
        <p className="list-row-sub">
          A job with no last-done date reads as due now — tick it off once and the
          schedule starts counting from there.
        </p>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Schedule</h2>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show paused
          </label>
        </div>

        {visible.length === 0 ? (
          <>
            <EmptyState icon="🔧" title="Nothing scheduled">
              The upkeep that only bites you when it&apos;s forgotten — filters, gutters,
              batteries, servicing.
            </EmptyState>
            {jobs.length === 0 && (
              <div className="water-actions">
                <button type="button" className="btn-secondary" onClick={addStarters}>
                  Start with the usual five
                </button>
              </div>
            )}
          </>
        ) : (
          <ul className="list">
            {visible.map((job) => {
              const open = openId === job.id
              const days = daysUntil(job.due)
              const item = itemFor(job.item_id)
              const history = logs.filter((log) => log.maintenance_id === job.id)

              return (
                <li key={job.id} className={`list-row${job.active ? '' : ' task-done'}`}>
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title task-title">{job.title}</span>
                      <span className="list-row-sub task-meta">
                        <span className={dueTone(job.due)}>
                          {days < 0
                            ? `${Math.abs(days)} days overdue`
                            : `due ${formatDueDate(job.due)}`}
                        </span>
                        <span>{intervalLabel(job)}</span>
                        {job.area && <span>{job.area}</span>}
                        {item && <span>{item.name}</span>}
                        {job.last_done && <span>last done {job.last_done}</span>}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => markDone(job)}
                    >
                      Done today
                    </button>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setOpenId(open ? null : job.id)}
                    >
                      {open ? 'Close' : 'Edit'}
                    </button>
                  </div>

                  {open && (
                    <>
                      <div className="task-controls">
                        <input
                          type="text"
                          className="inline-select"
                          value={job.title}
                          onChange={(e) => updateJob(job.id, { title: e.target.value })}
                        />
                        <input
                          type="text"
                          className="inline-select"
                          value={job.area || ''}
                          placeholder="area — e.g. HVAC, Outside"
                          onChange={(e) => updateJob(job.id, { area: e.target.value || null })}
                        />
                        <select
                          className="inline-select"
                          value={job.item_id || ''}
                          onChange={(e) => updateJob(job.id, { item_id: e.target.value || null })}
                        >
                          <option value="">No item</option>
                          {items.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </select>
                        <label className="filter-toggle">
                          every
                          <input
                            type="number"
                            min="1"
                            max="120"
                            className="target-input"
                            value={job.interval_value}
                            onChange={(e) =>
                              updateJob(job.id, {
                                interval_value: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                          <select
                            className="inline-select"
                            value={job.interval_unit}
                            onChange={(e) => updateJob(job.id, { interval_unit: e.target.value })}
                          >
                            {INTERVAL_UNITS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="filter-toggle">
                          Last done
                          <input
                            type="date"
                            className="inline-select"
                            value={job.last_done || ''}
                            onChange={(e) =>
                              updateJob(job.id, { last_done: e.target.value || null })
                            }
                          />
                        </label>
                        <input
                          type="text"
                          className="inline-select"
                          value={job.notes || ''}
                          placeholder="notes — filter size, who to call"
                          onChange={(e) => updateJob(job.id, { notes: e.target.value || null })}
                        />
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => updateJob(job.id, { active: !job.active })}
                        >
                          {job.active ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => deleteJob(job.id)}
                        >
                          Delete
                        </button>
                      </div>

                      {history.length > 0 && (
                        <p className="list-row-sub">
                          Done {history.length}×: {history.slice(0, 6).map((log) => log.done_on).join(' · ')}
                        </p>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

export default HouseholdMaintenance
