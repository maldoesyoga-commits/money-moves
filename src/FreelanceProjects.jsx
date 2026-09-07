import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { formatHours } from './lib/freelance'
import { formatDueDate, isOverdue } from './lib/taskDates'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

function FreelanceProjects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [minutesByProject, setMinutesByProject] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('freelance_projects')
      .select('*')
      .order('due_date', { nullsFirst: false })
      .order('created_at')

    if (error) {
      console.log('Failed to load freelance projects', error.message)
      return
    }

    setProjects(data)
  }, [])

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name')

    if (error) {
      console.log('Failed to load clients', error.message)
      return
    }

    setClients(data)
  }, [])

  const loadMinutes = useCallback(async () => {
    const { data, error } = await supabase.from('time_entries').select('project_id, minutes')

    if (error) {
      console.log('Failed to load time entries', error.message)
      return
    }

    const totals = {}
    data.forEach((entry) => {
      if (!entry.project_id) return
      totals[entry.project_id] = (totals[entry.project_id] || 0) + entry.minutes
    })

    setMinutesByProject(totals)
  }, [])

  useEffect(() => {
    loadProjects()
    loadClients()
    loadMinutes()
  }, [loadProjects, loadClients, loadMinutes])

  async function handleCreate(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed }
    if (clientId) payload.client_id = clientId
    if (dueDate) payload.due_date = dueDate

    const { error } = await supabase.from('freelance_projects').insert(payload)

    if (error) {
      console.log('Failed to create freelance project', error.message)
      return
    }

    setName('')
    setDueDate('')
    loadProjects()
  }

  async function updateProject(id, patch) {
    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, ...patch } : project)))

    const { error } = await supabase.from('freelance_projects').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update freelance project', error.message)
      loadProjects()
    }
  }

  async function deleteProject(id) {
    setProjects((prev) => prev.filter((project) => project.id !== id))

    const { error } = await supabase.from('freelance_projects').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete freelance project', error.message)
      loadProjects()
    }
  }

  function clientFor(id) {
    return clients.find((client) => client.id === id)
  }

  function rateFor(project) {
    return project.rate || clientFor(project.client_id)?.rate || null
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
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button type="submit">Add project</button>
        </div>
      </form>

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

      {visible.length === 0 ? (
        <p className="empty-text">No projects yet.</p>
      ) : (
        <ul className="list">
          {visible.map((project) => {
            const editing = editingId === project.id
            const minutes = minutesByProject[project.id] || 0
            const rate = rateFor(project)
            const earned = rate ? (minutes / 60) * Number(rate) : null
            const late = project.status !== 'done' && isOverdue(project.due_date)

            return (
              <li key={project.id} className="list-row project-row">
                <div className="task-row-body">
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{project.name}</span>
                    <span className="list-row-sub task-meta">
                      <span>{clientFor(project.client_id)?.name || 'No client'}</span>
                      {minutes > 0 && <span>{formatHours(minutes)}</span>}
                      {earned !== null && minutes > 0 && <span>{formatMoney(earned)}</span>}
                      {project.due_date && (
                        <span className={late ? 'task-overdue' : undefined}>
                          {formatDueDate(project.due_date)}
                        </span>
                      )}
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
                  <div className="learning-detail">
                    <div className="task-controls">
                      <input
                        type="text"
                        className="inline-select"
                        value={project.name}
                        onChange={(e) => updateProject(project.id, { name: e.target.value })}
                      />
                      <select
                        className="inline-select"
                        value={project.client_id || ''}
                        onChange={(e) =>
                          updateProject(project.id, { client_id: e.target.value || null })
                        }
                      >
                        <option value="">No client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="inline-select"
                        value={project.status}
                        onChange={(e) => updateProject(project.id, { status: e.target.value })}
                      >
                        {STATUSES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="inline-select"
                        value={project.due_date || ''}
                        onChange={(e) =>
                          updateProject(project.id, { due_date: e.target.value || null })
                        }
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="inline-select"
                        value={project.rate || ''}
                        placeholder="rate override"
                        onChange={(e) =>
                          updateProject(project.id, {
                            rate: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteProject(project.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <textarea
                      rows="2"
                      value={project.description || ''}
                      placeholder="what this project is"
                      onChange={(e) =>
                        updateProject(project.id, { description: e.target.value || null })
                      }
                    />
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

export default FreelanceProjects
