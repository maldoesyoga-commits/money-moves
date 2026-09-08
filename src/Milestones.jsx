import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'
import { report } from './lib/report'

const VIEWS = [
  { key: 'upcoming', label: 'Ahead' },
  { key: 'achieved', label: 'Reached' },
  { key: 'all', label: 'All' },
]

// The whole log, in one place. Every milestone set anywhere in the app lands
// here — this is the looking-back view.
function Milestones() {
  const [milestones, setMilestones] = useState([])
  const [projects, setProjects] = useState([])
  const [flProjects, setFlProjects] = useState([])
  const [goals, setGoals] = useState([])
  const [view, setView] = useState('upcoming')
  const [attachFilter, setAttachFilter] = useState('all')

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [attachTo, setAttachTo] = useState('')

  const load = useCallback(async () => {
    const [{ data, error }, { data: projectRows }, { data: flRows }, { data: goalRows }] =
      await Promise.all([
        supabase.from('milestones').select('*'),
        supabase.from('projects').select('id, name, color').order('name'),
        supabase.from('freelance_projects').select('id, name').order('name'),
        supabase.from('twy_goals').select('id, title, color').order('sort_order'),
      ])

    if (error) {
      report('Failed to load milestones', error)
      return
    }

    setMilestones(data || [])
    setProjects(projectRows || [])
    setFlProjects(flRows || [])
    setGoals(goalRows || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addMilestone(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const payload = { title: trimmed, target_date: date || null }

    if (attachTo) {
      const [kind, id] = attachTo.split(':')
      if (kind === 'project') payload.project_id = id
      if (kind === 'freelance') payload.freelance_project_id = id
      if (kind === 'goal') payload.goal_id = id
    }

    const { error } = await supabase.from('milestones').insert(payload)

    if (error) {
      report('Failed to add milestone', error)
      return
    }

    setTitle('')
    setDate('')
    load()
  }

  async function toggle(milestone) {
    const patch = milestone.achieved
      ? { achieved: false, achieved_on: null }
      : { achieved: true, achieved_on: todayISO() }

    setMilestones((prev) =>
      prev.map((row) => (row.id === milestone.id ? { ...row, ...patch } : row)),
    )

    const { error } = await supabase.from('milestones').update(patch).eq('id', milestone.id)

    if (error) {
      report('Failed to update milestone', error)
      load()
    }
  }

  async function updateMilestone(id, patch) {
    setMilestones((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('milestones').update(patch).eq('id', id)

    if (error) {
      report('Failed to update milestone', error)
      load()
    }
  }

  async function remove(id) {
    setMilestones((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('milestones').delete().eq('id', id)

    if (error) {
      report('Failed to delete milestone', error)
      load()
    }
  }

  function attachment(milestone) {
    if (milestone.project_id) {
      const project = projects.find((row) => row.id === milestone.project_id)
      return project
        ? { label: project.name, to: `/tasks/projects/${project.id}`, color: project.color }
        : null
    }
    if (milestone.freelance_project_id) {
      const project = flProjects.find((row) => row.id === milestone.freelance_project_id)
      return project ? { label: project.name, to: '/freelance/projects' } : null
    }
    if (milestone.goal_id) {
      const goal = goals.find((row) => row.id === milestone.goal_id)
      return goal ? { label: `🎯 ${goal.title}`, to: '/goals/plan', color: goal.color } : null
    }
    return null
  }

  const filtered = milestones.filter((row) => {
    if (view === 'upcoming' && row.achieved) return false
    if (view === 'achieved' && !row.achieved) return false

    if (attachFilter === 'none') {
      return !row.project_id && !row.freelance_project_id && !row.goal_id
    }
    if (attachFilter === 'goals') return Boolean(row.goal_id)
    if (attachFilter === 'projects') {
      return Boolean(row.project_id || row.freelance_project_id)
    }
    return true
  })

  // Ahead reads forward by target date; reached reads backward, newest first.
  const sorted = [...filtered].sort((a, b) => {
    if (view === 'achieved') {
      return (b.achieved_on || '') < (a.achieved_on || '') ? -1 : 1
    }
    if (!a.target_date) return 1
    if (!b.target_date) return -1
    return a.target_date < b.target_date ? -1 : 1
  })

  // Reached milestones group by year — that's the shape of looking back.
  const groups =
    view === 'achieved'
      ? sorted.reduce((acc, row) => {
          const key = row.achieved_on ? row.achieved_on.slice(0, 4) : 'No date'
          acc[key] = acc[key] || []
          acc[key].push(row)
          return acc
        }, {})
      : { '': sorted }

  const reached = milestones.filter((row) => row.achieved).length
  const thisYear = milestones.filter(
    (row) => row.achieved && row.achieved_on?.startsWith(String(new Date().getFullYear())),
  ).length
  const overdue = milestones.filter(
    (row) => !row.achieved && isOverdue(row.target_date),
  ).length

  return (
    <section className="milestones-module">
      <div className="home-greeting">
        <h1>Milestones</h1>
        <p className="list-row-sub">The moments, not the to-dos.</p>
      </div>

      <div className="review-grid">
        <div className="review-stat">
          <span className="review-stat-value">{reached}</span>
          <span className="review-stat-label">Reached</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{thisYear}</span>
          <span className="review-stat-label">This year</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{milestones.length - reached}</span>
          <span className="review-stat-label">Ahead</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{overdue}</span>
          <span className="review-stat-label">Past their date</span>
        </div>
      </div>

      <div className="card">
        <h2>Add a milestone</h2>
        <form className="field-row" onSubmit={addMilestone}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="what happened, or what you're heading for"
          />
          <input
            type="date"
            className="inline-select"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <select
            className="inline-select"
            value={attachTo}
            onChange={(e) => setAttachTo(e.target.value)}
          >
            <option value="">Not attached</option>
            {goals.length > 0 && (
              <optgroup label="Goals">
                {goals.map((goal) => (
                  <option key={goal.id} value={`goal:${goal.id}`}>
                    {goal.title}
                  </option>
                ))}
              </optgroup>
            )}
            {projects.length > 0 && (
              <optgroup label="Projects">
                {projects.map((project) => (
                  <option key={project.id} value={`project:${project.id}`}>
                    {project.name}
                  </option>
                ))}
              </optgroup>
            )}
            {flProjects.length > 0 && (
              <optgroup label="Freelance">
                {flProjects.map((project) => (
                  <option key={project.id} value={`freelance:${project.id}`}>
                    {project.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button type="submit">Add</button>
        </form>
        <p className="list-row-sub">
          A milestone marks a moment — first paying client, 500 followers, the launch.
          If it&apos;s something you have to <em>do</em>, it&apos;s a task; if it&apos;s
          something that has to be <em>true</em>, it&apos;s an objective on a goal.
        </p>
      </div>

      <nav className="segmented-nav">
        {VIEWS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`segmented-tab${view === option.key ? ' active' : ''}`}
            onClick={() => setView(option.key)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      <div className="card">
        <div className="transaction-filter-bar">
          <label className="filter-toggle">
            Attached to
            <select
              className="inline-select"
              value={attachFilter}
              onChange={(e) => setAttachFilter(e.target.value)}
            >
              <option value="all">Anything</option>
              <option value="goals">Goals</option>
              <option value="projects">Projects</option>
              <option value="none">Nothing</option>
            </select>
          </label>
        </div>

        {sorted.length === 0 ? (
          <EmptyState icon="🏔️" title="Nothing here yet">
            Add one above, or set them from inside a project or a goal — they all end up
            in this log either way.
          </EmptyState>
        ) : (
          Object.entries(groups).map(([key, rows]) => (
            <div className="category-group-block" key={key || 'all'}>
              {key && <h3>{key}</h3>}
              <ul className="list">
                {rows.map((milestone) => {
                  const link = attachment(milestone)
                  const late = !milestone.achieved && isOverdue(milestone.target_date)

                  return (
                    <li
                      key={milestone.id}
                      className={`list-row task-row${milestone.achieved ? ' task-done' : ''}`}
                    >
                      <div className="task-row-body">
                        <button
                          type="button"
                          className={`task-check${milestone.achieved ? ' checked' : ''}`}
                          onClick={() => toggle(milestone)}
                          aria-label={milestone.achieved ? 'Not yet' : 'Mark reached'}
                        >
                          {milestone.achieved ? '✓' : ''}
                        </button>

                        <div className="list-row-main task-main">
                          <span className="list-row-title task-title">{milestone.title}</span>
                          <span className="list-row-sub task-meta">
                            {milestone.achieved ? (
                              <span>reached {formatDueDate(milestone.achieved_on)}</span>
                            ) : milestone.target_date ? (
                              <span className={late ? 'task-overdue' : undefined}>
                                {formatDueDate(milestone.target_date)}
                              </span>
                            ) : (
                              <span>no date</span>
                            )}
                            {link && (
                              <Link to={link.to} className="project-link">
                                {link.label}
                              </Link>
                            )}
                          </span>
                        </div>

                        {milestone.achieved ? (
                          <input
                            type="date"
                            className="inline-select"
                            value={milestone.achieved_on || ''}
                            title="When it actually happened"
                            onChange={(e) =>
                              updateMilestone(milestone.id, {
                                achieved_on: e.target.value || null,
                              })
                            }
                          />
                        ) : (
                          <input
                            type="date"
                            className="inline-select"
                            value={milestone.target_date || ''}
                            title="Target date"
                            onChange={(e) =>
                              updateMilestone(milestone.id, {
                                target_date: e.target.value || null,
                              })
                            }
                          />
                        )}

                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => remove(milestone.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default Milestones
