import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatMoney } from './lib/format'
import { formatHours } from './lib/freelance'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'
import { report } from './lib/report'
import MilestoneList from './MilestoneList'
import ProjectResources from './ProjectResources'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'plan', label: 'Plan' },
  { key: 'resources', label: 'Resources' },
]

function FreelanceProjectDetail() {
  const { projectId } = useParams()

  const [project, setProject] = useState(null)
  const [client, setClient] = useState(null)
  const [tasks, setTasks] = useState([])
  const [entries, setEntries] = useState([])
  const [tab, setTab] = useState('overview')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')

  const [notesDraft, setNotesDraft] = useState('')
  const [planDraft, setPlanDraft] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('freelance_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) {
      report('Failed to load the project', error)
      return
    }

    setProject(data)
    setNotesDraft(data.notes || '')
    setPlanDraft(data.plan || '')

    const [{ data: taskRows }, { data: entryRows }, { data: clientRow }] = await Promise.all([
      supabase.from('tasks').select('*').eq('freelance_project_id', projectId),
      supabase.from('time_entries').select('*').eq('project_id', projectId),
      data.client_id
        ? supabase.from('clients').select('*').eq('id', data.client_id).single()
        : Promise.resolve({ data: null }),
    ])

    setTasks(taskRows || [])
    setEntries(entryRows || [])
    setClient(clientRow || null)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  // Notes and plan save on a pause, not on every keystroke.
  useEffect(() => {
    if (!project) return undefined
    if (notesDraft === (project.notes || '') && planDraft === (project.plan || '')) return undefined

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from('freelance_projects')
        .update({ notes: notesDraft || null, plan: planDraft || null })
        .eq('id', projectId)

      if (error) {
        report('Failed to save', error)
        return
      }

      setProject((prev) => ({ ...prev, notes: notesDraft, plan: planDraft }))
      setSavedAt(new Date())
    }, 700)

    return () => clearTimeout(timer)
  }, [notesDraft, planDraft, project, projectId])

  async function updateProject(patch) {
    setProject((prev) => ({ ...prev, ...patch }))

    const { error } = await supabase.from('freelance_projects').update(patch).eq('id', projectId)

    if (error) {
      report('Failed to update the project', error)
      load()
    }
  }

  async function addTask(e) {
    e.preventDefault()

    const trimmed = taskTitle.trim()
    if (!trimmed) return

    const payload = {
      title: trimmed,
      status: 'todo',
      freelance_project_id: projectId,
    }
    if (taskDue) payload.due_date = taskDue

    const { error } = await supabase.from('tasks').insert(payload)

    if (error) {
      report('Failed to add the task', error)
      return
    }

    setTaskTitle('')
    setTaskDue('')
    load()
  }

  async function toggleTask(task) {
    const done = task.status !== 'done'
    const patch = {
      status: done ? 'done' : 'todo',
      done_at: done ? new Date().toISOString() : null,
    }

    setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)

    if (error) {
      report('Failed to update the task', error)
      load()
    }
  }

  async function deleteTask(id) {
    setTasks((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      report('Failed to delete the task', error)
      load()
    }
  }

  if (!project) return <p className="empty-text">Loading…</p>

  const done = tasks.filter((task) => task.status === 'done').length
  const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
  const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0)
  const rate = project.rate || client?.rate || null
  const earned = rate ? (minutes / 60) * Number(rate) : null
  const today = todayISO()

  return (
    <>
      <div className="card project-detail-head">
        <div className="project-scope-header">
          <div className="project-title-row">
            <h2>{project.name}</h2>
          </div>
          <Link to="/freelance/projects" className="row-action-btn">
            All projects
          </Link>
        </div>

        <p className="list-row-sub task-meta">
          {client && <span>{client.name}</span>}
          <span>{STATUSES.find((row) => row.value === project.status)?.label}</span>
          {project.start_date && <span>from {project.start_date}</span>}
          {project.end_date && <span>to {project.end_date}</span>}
          {project.due_date && (
            <span className={isOverdue(project.due_date) ? 'task-overdue' : undefined}>
              deadline {formatDueDate(project.due_date)}
            </span>
          )}
        </p>

        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="list-row-sub">
            {done} of {tasks.length} tasks done ({pct}%) · {formatHours(minutes)} logged
            {earned !== null && ` · ${formatMoney(earned)}`}
          </p>
        </div>
      </div>

      <nav className="segmented-nav">
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`segmented-tab${tab === option.key ? ' active' : ''}`}
            onClick={() => setTab(option.key)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className="card">
            <h3>Details</h3>

            <div className="task-controls">
              <input
                type="text"
                className="inline-select"
                value={project.name}
                onChange={(e) => updateProject({ name: e.target.value })}
              />
              <select
                className="inline-select"
                value={project.status}
                onChange={(e) => updateProject({ status: e.target.value })}
              >
                {STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                className="target-input"
                value={project.rate || ''}
                placeholder="rate"
                onChange={(e) =>
                  updateProject({ rate: e.target.value ? Number(e.target.value) : null })
                }
              />
            </div>

            <div className="task-controls">
              <label className="filter-toggle">
                Starts
                <input
                  type="date"
                  className="inline-select"
                  value={project.start_date || ''}
                  onChange={(e) => updateProject({ start_date: e.target.value || null })}
                />
              </label>
              <label className="filter-toggle">
                Ends
                <input
                  type="date"
                  className="inline-select"
                  value={project.end_date || ''}
                  onChange={(e) => updateProject({ end_date: e.target.value || null })}
                />
              </label>
              <label className="filter-toggle">
                Deadline (optional)
                <input
                  type="date"
                  className="inline-select"
                  value={project.due_date || ''}
                  onChange={(e) => updateProject({ due_date: e.target.value || null })}
                />
              </label>
            </div>
          </div>

          <div className="review-grid">
            <div className="review-stat">
              <span className="review-stat-value">{tasks.length - done}</span>
              <span className="review-stat-label">Tasks open</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-value">{formatHours(minutes)}</span>
              <span className="review-stat-label">Time logged</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-value">
                {earned === null ? '—' : formatMoney(earned)}
              </span>
              <span className="review-stat-label">Worth</span>
              {rate && <span className="review-stat-sub">{formatMoney(rate)}/h</span>}
            </div>
          </div>

          <MilestoneList
            freelanceProjectId={projectId}
            hint="The moments this job is aiming at — not the tasks that get you there."
          />

          {entries.length > 0 && (
            <div className="card">
              <div className="project-scope-header">
                <h3>Recent sessions</h3>
                <Link to="/freelance/time" className="row-action-btn">
                  Time
                </Link>
              </div>
              <ul className="list">
                {[...entries]
                  .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
                  .slice(0, 6)
                  .map((entry) => (
                    <li key={entry.id} className="list-row">
                      <div className="list-row-main">
                        <span className="list-row-title">{entry.notes || 'Session'}</span>
                        <span className="list-row-sub task-meta">
                          <span>{entry.entry_date}</span>
                          <span>{formatHours(entry.minutes)}</span>
                          {entry.invoice_id && <span className="priority-pill">Invoiced</span>}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}

      {tab === 'tasks' && (
        <div className="card">
          <h3>Tasks</h3>
          <p className="list-row-sub">
            These are normal tasks — they show in Tasks &amp; Projects and on the planner
            too, tagged to this job.
          </p>

          <form className="field-row" onSubmit={addTask}>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="what needs doing"
            />
            <input
              type="date"
              className="inline-select"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>

          {tasks.length === 0 ? (
            <EmptyState icon="✅" title="No tasks yet">
              Break the job into steps and tick them off — the progress bar above follows
              them.
            </EmptyState>
          ) : (
            <ul className="list">
              {[...tasks]
                .sort((a, b) => (a.status === 'done') - (b.status === 'done'))
                .map((task) => (
                  <li
                    key={task.id}
                    className={`list-row task-row${task.status === 'done' ? ' task-done' : ''}`}
                  >
                    <div className="task-row-body">
                      <button
                        type="button"
                        className={`task-check${task.status === 'done' ? ' checked' : ''}`}
                        onClick={() => toggleTask(task)}
                        aria-label="Toggle"
                      >
                        {task.status === 'done' ? '✓' : ''}
                      </button>
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">{task.title}</span>
                        {task.due_date && (
                          <span
                            className={`list-row-sub${
                              task.status !== 'done' && task.due_date < today
                                ? ' task-overdue'
                                : ''
                            }`}
                          >
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="card">
          <h3>Notes</h3>
          <p className="list-row-sub">
            What was agreed, what was said, links, logins to ask for — the running record
            of the job.
          </p>
          <textarea
            rows="12"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="…"
          />
          <p className="list-row-sub">
            {savedAt
              ? `Saved ${savedAt.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Saves as you type.'}
          </p>
        </div>
      )}

      {tab === 'plan' && (
        <div className="card">
          <h3>Plan</h3>
          <p className="list-row-sub">
            Scope, phases, what happens in what order. Separate from notes so the plan
            doesn&apos;t get buried under the running commentary.
          </p>
          <textarea
            rows="12"
            value={planDraft}
            onChange={(e) => setPlanDraft(e.target.value)}
            placeholder="Phase 1 — …"
          />
          <p className="list-row-sub">
            {savedAt
              ? `Saved ${savedAt.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Saves as you type.'}
          </p>
        </div>
      )}

      {tab === 'resources' && <ProjectResources freelanceProjectId={projectId} />}
    </>
  )
}

export default FreelanceProjectDetail
