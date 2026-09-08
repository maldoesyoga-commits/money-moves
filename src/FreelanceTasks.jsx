import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { BRAND_LABEL } from './lib/freelance'
import { todayISO, formatDueDate } from './lib/taskDates'
import { report } from './lib/report'

// A task list per client. These are ordinary tasks tagged with a client_id, so
// they also show up in Tasks & Projects and on the planner. Your own personal
// to-dos stay in the Tasks module — this board is just the client work.
function FreelanceTasks() {
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [titles, setTitles] = useState({})
  const [dues, setDues] = useState({})

  const load = useCallback(async () => {
    const [{ data: clientRows, error: clientError }, { data: taskRows, error: taskError }] =
      await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('tasks').select('*').not('client_id', 'is', null),
      ])

    if (clientError) {
      report('Failed to load clients', clientError)
      return
    }
    if (taskError) {
      report('Failed to load tasks', taskError)
      return
    }

    setClients(clientRows || [])
    setTasks(taskRows || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addTask(clientId) {
    const title = (titles[clientId] || '').trim()
    if (!title) return

    const payload = { title, status: 'todo', client_id: clientId }
    if (dues[clientId]) payload.due_date = dues[clientId]

    const { error } = await supabase.from('tasks').insert(payload)

    if (error) {
      report('Failed to add the task', error)
      return
    }

    setTitles((prev) => ({ ...prev, [clientId]: '' }))
    setDues((prev) => ({ ...prev, [clientId]: '' }))
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

  const today = todayISO()
  const activeClients = clients.filter((client) => client.status !== 'past')

  if (activeClients.length === 0) {
    return (
      <div className="card">
        <h2>Client tasks</h2>
        <EmptyState icon="✅" title="No clients yet">
          Add a client first — each one gets its own task list here.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <div className="home-greeting">
        <h2>Client tasks</h2>
        <p className="list-row-sub">
          One list per client. These show in Tasks &amp; Projects too — your own to-dos live
          there separately.
        </p>
      </div>

      {activeClients.map((client) => {
        const clientTasks = tasks
          .filter((task) => task.client_id === client.id)
          .sort((a, b) => (a.status === 'done') - (b.status === 'done'))
        const openCount = clientTasks.filter((task) => task.status !== 'done').length

        return (
          <div className="card" key={client.id}>
            <div className="project-scope-header">
              <div className="project-title-row">
                <span className={`brand-dot brand-${client.brand}`} />
                <h3>{client.name}</h3>
              </div>
              <Link to={`/freelance/clients/${client.id}`} className="row-action-btn">
                Open client
              </Link>
            </div>
            <p className="list-row-sub">
              {BRAND_LABEL[client.brand]} · {openCount} open
            </p>

            <form
              className="field-row"
              onSubmit={(e) => {
                e.preventDefault()
                addTask(client.id)
              }}
            >
              <input
                type="text"
                value={titles[client.id] || ''}
                onChange={(e) => setTitles((prev) => ({ ...prev, [client.id]: e.target.value }))}
                placeholder="what needs doing"
              />
              <input
                type="date"
                className="inline-select"
                value={dues[client.id] || ''}
                onChange={(e) => setDues((prev) => ({ ...prev, [client.id]: e.target.value }))}
              />
              <button type="submit">Add</button>
            </form>

            {clientTasks.length > 0 && (
              <ul className="list">
                {clientTasks.map((task) => (
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
                              task.status !== 'done' && task.due_date < today ? ' task-overdue' : ''
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
        )
      })}
    </>
  )
}

export default FreelanceTasks
