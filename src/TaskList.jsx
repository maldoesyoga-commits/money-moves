import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import TagPicker from './TagPicker'
import EmptyState from './EmptyState'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'
import { REPEATS, REPEAT_LABEL, REPEAT_UNIT, nextOccurrence } from './lib/recurrence'

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'nodate', label: 'No date' },
  { key: 'done', label: 'Done' },
]

const PRIORITY_LABEL = { high: 'High', med: 'Medium', low: 'Low' }

function TaskList({ onChanged }) {
  const { projectId } = useParams()

  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [view, setView] = useState('today')
  const [projectFilter, setProjectFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [newProjectId, setNewProjectId] = useState('')

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { nullsFirst: false })
      .order('created_at')

    if (error) {
      console.log('Failed to load tasks', error.message)
      return
    }

    setTasks(data)
  }, [])

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load projects', error.message)
      return
    }

    setProjects(data)
  }, [])

  useEffect(() => {
    loadTasks()
    loadProjects()
  }, [loadTasks, loadProjects])

  useEffect(() => {
    if (projectId) setNewProjectId(projectId)
  }, [projectId])

  const activeProject = projects.find((project) => project.id === projectId)

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const payload = { title: trimmed, status: 'todo' }
    if (dueDate) payload.due_date = dueDate

    const chosenProject = projectId || newProjectId
    if (chosenProject) payload.project_id = chosenProject

    const { error } = await supabase.from('tasks').insert(payload)

    if (error) {
      console.log('Failed to add task', error.message)
      return
    }

    setTitle('')
    setDueDate('')
    loadTasks()
    onChanged?.()
  }

  async function updateTask(id, patch) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)))

    const { error } = await supabase.from('tasks').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update task', error.message)
      loadTasks()
      return
    }

    onChanged?.()
  }

  async function toggleDone(task) {
    const done = task.status !== 'done'

    await updateTask(task.id, {
      status: done ? 'done' : 'todo',
      done_at: done ? new Date().toISOString() : null,
    })

    // Completing a repeating task queues up the next one.
    if (done && task.repeat_every) {
      const next = nextOccurrence(task)
      const { error } = await supabase.from('tasks').insert(next)

      if (error) {
        console.log('Failed to create next occurrence', error.message)
        return
      }

      loadTasks()
    }
  }

  async function deleteTask(id) {
    setTasks((prev) => prev.filter((task) => task.id !== id))

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete task', error.message)
      loadTasks()
      return
    }

    onChanged?.()
  }

  const visible = useMemo(() => {
    const today = todayISO()

    return tasks.filter((task) => {
      if (projectId && task.project_id !== projectId) return false
      if (!projectId && projectFilter !== 'all') {
        if (projectFilter === 'none' ? task.project_id : task.project_id !== projectFilter) {
          return false
        }
      }

      const done = task.status === 'done'

      if (view === 'done') return done
      if (done) return false
      if (view === 'today') return Boolean(task.due_date) && task.due_date <= today
      if (view === 'upcoming') return Boolean(task.due_date) && task.due_date > today
      return !task.due_date
    })
  }, [tasks, view, projectFilter, projectId])

  function projectName(id) {
    return projects.find((project) => project.id === id)?.name
  }

  function countFor(key) {
    const today = todayISO()
    return tasks.filter((task) => {
      if (projectId && task.project_id !== projectId) return false
      const done = task.status === 'done'
      if (key === 'done') return done
      if (done) return false
      if (key === 'today') return Boolean(task.due_date) && task.due_date <= today
      if (key === 'upcoming') return Boolean(task.due_date) && task.due_date > today
      return !task.due_date
    }).length
  }

  return (
    <div className="card">
      {activeProject && (
        <div className="project-scope-header">
          <h2>{activeProject.name}</h2>
          <Link to="/tasks/projects" className="row-action-btn">
            All projects
          </Link>
        </div>
      )}

      <form className="quick-add" onSubmit={handleAdd}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="quick-add-title"
        />
        <div className="field-row">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {!projectId && (
            <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects
                .filter((project) => project.status === 'active')
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          )}
          <button type="submit">Add task</button>
        </div>
      </form>

      <nav className="view-tabs">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`view-tab${view === key ? ' active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
            <span className="view-tab-count">{countFor(key)}</span>
          </button>
        ))}
      </nav>

      {!projectId && projects.length > 0 && (
        <div className="transaction-filter-bar">
          <label className="filter-toggle">
            Project
            <select
              className="inline-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="none">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        tasks.length === 0 ? (
          <EmptyState icon="✅" title="No tasks yet">
            Type one in the box above. Give it a due date and it shows under Today;
            leave the date off and it waits in No date until you&apos;re ready.
          </EmptyState>
        ) : (
          <p className="empty-text">
            {view === 'done' ? 'Nothing finished yet.' : 'Nothing here — enjoy the quiet.'}
          </p>
        )
      ) : (
        <ul className="list">
          {visible.map((task) => {
            const done = task.status === 'done'
            const overdue = !done && isOverdue(task.due_date)
            const open = expandedId === task.id

            return (
              <li key={task.id} className={`list-row task-row${done ? ' task-done' : ''}`}>
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`task-check${done ? ' checked' : ''}`}
                    onClick={() => toggleDone(task)}
                    aria-label={done ? 'Mark as not done' : 'Mark as done'}
                  >
                    {done ? '✓' : ''}
                  </button>

                  <div className="list-row-main task-main">
                    <span className="list-row-title task-title">{task.title}</span>
                    <span className="list-row-sub task-meta">
                      <span className={overdue ? 'task-overdue' : undefined}>
                        {formatDueDate(task.due_date)}
                      </span>
                      {task.priority && <span className={`priority-pill priority-${task.priority}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>}
                      {task.project_id && <span>{projectName(task.project_id)}</span>}
                      {task.repeat_every && (
                        <span className="repeat-pill">
                          ↻{' '}
                          {task.repeat_interval > 1
                            ? `every ${task.repeat_interval}`
                            : REPEAT_LABEL[task.repeat_every]}
                        </span>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setExpandedId(open ? null : task.id)}
                  >
                    {open ? 'Close' : 'Edit'}
                  </button>
                </div>

                {open && (
                  <div className="task-controls">
                    <input
                      type="date"
                      className="inline-select"
                      value={task.due_date || ''}
                      onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
                    />
                    <select
                      className="inline-select"
                      value={task.priority || ''}
                      onChange={(e) => updateTask(task.id, { priority: e.target.value || null })}
                    >
                      <option value="">No priority</option>
                      <option value="high">High</option>
                      <option value="med">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <select
                      className="inline-select"
                      value={task.project_id || ''}
                      onChange={(e) => updateTask(task.id, { project_id: e.target.value || null })}
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="inline-select"
                      value={task.repeat_every || ''}
                      onChange={(e) =>
                        updateTask(task.id, { repeat_every: e.target.value || null })
                      }
                    >
                      {REPEATS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {task.repeat_every && (
                      <label className="filter-toggle repeat-interval">
                        every
                        <input
                          type="number"
                          min="1"
                          max="52"
                          className="target-input"
                          value={task.repeat_interval || 1}
                          onChange={(e) =>
                            updateTask(task.id, {
                              repeat_interval: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                        {REPEAT_UNIT[task.repeat_every]}
                      </label>
                    )}
                    <button
                      type="button"
                      className="row-action-btn row-action-btn-danger"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete
                    </button>
                    <TagPicker table="tasks" id={task.id} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default TaskList
