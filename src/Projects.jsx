import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { report } from './lib/report'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

const COLORS = ['#3f6b5c', '#b87333', '#4e6e8a', '#bf8f6b', '#6e7a75']

const MODES = [
  { key: 'list', label: 'List' },
  { key: 'board', label: 'Board' },
]

const BOARD_ORDER = ['active', 'on_hold', 'done', 'archived']

function Projects() {
  const [projects, setProjects] = useState([])
  const [taskCounts, setTaskCounts] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [mode, setMode] = useState('list')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (error) {
      report('Failed to load projects', error)
      return
    }

    setProjects(data)
  }, [])

  const loadCounts = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('project_id, status')

    if (error) {
      report('Failed to load task counts', error)
      return
    }

    const counts = {}
    data.forEach((task) => {
      if (!task.project_id) return
      const entry = counts[task.project_id] || { open: 0, done: 0 }
      if (task.status === 'done') entry.done += 1
      else entry.open += 1
      counts[task.project_id] = entry
    })

    setTaskCounts(counts)
  }, [])

  useEffect(() => {
    loadProjects()
    loadCounts()
  }, [loadProjects, loadCounts])

  async function handleCreate(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed, color, sort_order: projects.length }
    if (description.trim()) payload.description = description.trim()

    const { error } = await supabase.from('projects').insert(payload)

    if (error) {
      report('Failed to create project', error)
      return
    }

    setName('')
    setDescription('')
    setColor(COLORS[0])
    loadProjects()
  }

  async function updateProject(id, patch) {
    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, ...patch } : project)))

    const { error } = await supabase.from('projects').update(patch).eq('id', id)

    if (error) {
      report('Failed to update project', error)
      loadProjects()
    }
  }

  const visible = projects.filter((project) => showArchived || project.status !== 'archived')

  return (
    <div className="card">
      <h2>Projects</h2>

      <form onSubmit={handleCreate}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="project name"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="description (optional)"
          />
        </div>
        <div className="color-picker-row">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`color-swatch${color === swatch ? ' selected' : ''}`}
              style={{ background: swatch }}
              onClick={() => setColor(swatch)}
              aria-label={`Colour ${swatch}`}
            />
          ))}
        </div>
        <button type="submit">Create project</button>
      </form>

      <nav className="segmented-nav view-mode-nav">
        {MODES.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`segmented-tab${mode === option.key ? ' active' : ''}`}
            onClick={() => setMode(option.key)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {mode === 'list' && (
        <div className="transaction-filter-bar">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
      )}

      {mode === 'board' && (
        <div className="board">
          {BOARD_ORDER.map((status) => {
            const columnProjects = projects.filter((project) => project.status === status)
            const label = STATUSES.find((option) => option.value === status)?.label

            return (
              <div className="board-column" key={status}>
                <div className="board-column-head">
                  <h3>{label}</h3>
                  <span className="list-row-sub">{columnProjects.length}</span>
                </div>

                {columnProjects.length === 0 ? (
                  <p className="empty-text">—</p>
                ) : (
                  <ul className="board-cards">
                    {columnProjects.map((project) => {
                      const counts = taskCounts[project.id] || { open: 0, done: 0 }
                      const index = BOARD_ORDER.indexOf(status)

                      return (
                        <li
                          key={project.id}
                          className={`board-card${status === 'archived' ? ' card-done' : ''}`}
                          style={
                            project.color ? { '--card-accent': project.color } : undefined
                          }
                        >
                          <Link
                            to={`/tasks/projects/${project.id}`}
                            className="board-card-title project-link"
                          >
                            {project.name}
                          </Link>
                          <div className="board-card-meta">
                            <span className="list-row-sub">
                              {counts.open} open · {counts.done} done
                            </span>
                          </div>
                          <div className="stage-nudge">
                            <button
                              type="button"
                              className="row-action-btn"
                              disabled={index <= 0}
                              onClick={() =>
                                updateProject(project.id, { status: BOARD_ORDER[index - 1] })
                              }
                              aria-label="Move left"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="row-action-btn"
                              disabled={index >= BOARD_ORDER.length - 1}
                              onClick={() =>
                                updateProject(project.id, { status: BOARD_ORDER[index + 1] })
                              }
                              aria-label="Move right"
                            >
                              ›
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {mode === 'list' && (visible.length === 0 ? (
        <EmptyState icon="🗂️" title="No projects yet">
          A project is a bucket for related tasks — a client job, a launch, a room
          you&apos;re redoing. Name one above, then tag tasks into it.
        </EmptyState>
      ) : (
        <ul className="list">
          {visible.map((project) => {
            const counts = taskCounts[project.id] || { open: 0, done: 0 }
            const editing = editingId === project.id

            return (
              <li key={project.id} className="list-row project-row">
                <div className="task-row-body">
                  <span
                    className="project-dot"
                    style={{ background: project.color || 'var(--text-soft)' }}
                  />
                  <div className="list-row-main task-main">
                    <Link to={`/tasks/projects/${project.id}`} className="list-row-title project-link">
                      {project.name}
                    </Link>
                    <span className="list-row-sub">
                      {counts.open} open · {counts.done} done
                      {project.description ? ` — ${project.description}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setEditingId(editing ? null : project.id)}
                  >
                    {editing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {editing && (
                  <div className="task-controls">
                    <input
                      type="text"
                      className="inline-select"
                      value={project.name}
                      onChange={(e) => updateProject(project.id, { name: e.target.value })}
                    />
                    <input
                      type="text"
                      className="inline-select"
                      value={project.description || ''}
                      placeholder="description"
                      onChange={(e) =>
                        updateProject(project.id, { description: e.target.value || null })
                      }
                    />
                    <select
                      className="inline-select"
                      value={project.status}
                      onChange={(e) => updateProject(project.id, { status: e.target.value })}
                    >
                      {STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <div className="color-picker-row">
                      {COLORS.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          className={`color-swatch${project.color === swatch ? ' selected' : ''}`}
                          style={{ background: swatch }}
                          onClick={() => updateProject(project.id, { color: swatch })}
                          aria-label={`Colour ${swatch}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}

export default Projects
