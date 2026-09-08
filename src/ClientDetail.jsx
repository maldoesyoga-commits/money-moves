import { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import TagPicker from './TagPicker'
import ClientLinks from './ClientLinks'
import { formatMoney } from './lib/format'
import { formatHours, BRANDS, BRAND_LABEL } from './lib/freelance'
import { todayISO, formatDueDate } from './lib/taskDates'
import { report } from './lib/report'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'past', label: 'Past' },
]

const PROJECT_STATUS = {
  active: 'Active',
  on_hold: 'On hold',
  done: 'Done',
  archived: 'Archived',
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'brand', label: 'Brand kit' },
  { key: 'content', label: 'Content' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'projects', label: 'Projects' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'reference', label: 'Reference' },
]

// Pull anything that looks like a hex code out of the free-text colours field
// so we can show a swatch next to it.
function hexSwatches(text) {
  if (!text) return []
  return text.match(/#[0-9a-fA-F]{3,8}/g) || []
}

function ClientDetail() {
  const { clientId } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [tasks, setTasks] = useState([])
  const [content, setContent] = useState([])
  const [tab, setTab] = useState('overview')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (error) {
      report('Failed to load the client', error)
      return
    }

    setClient(data)

    const [
      { data: projectRows },
      { data: entryRows },
      { data: invoiceRows },
      { data: taskRows },
      { data: contentRows },
    ] = await Promise.all([
      supabase.from('freelance_projects').select('*').eq('client_id', clientId).order('name'),
      supabase.from('time_entries').select('*'),
      supabase.from('invoices').select('*').eq('client_id', clientId),
      supabase.from('tasks').select('*').eq('client_id', clientId),
      data.brand
        ? supabase.from('content_items').select('*').eq('brand', data.brand)
        : Promise.resolve({ data: [] }),
    ])

    setProjects(projectRows || [])
    setEntries(entryRows || [])
    setInvoices(invoiceRows || [])
    setTasks(taskRows || [])
    setContent(contentRows || [])
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  async function updateClient(patch) {
    setClient((prev) => ({ ...prev, ...patch }))

    const { error } = await supabase.from('clients').update(patch).eq('id', clientId)

    if (error) {
      report('Failed to update the client', error)
      load()
    }
  }

  async function deleteClient() {
    if (!window.confirm(`Delete ${client.name}? This can't be undone.`)) return

    const { error } = await supabase.from('clients').delete().eq('id', clientId)

    if (error) {
      report('Failed to delete the client', error)
      return
    }

    navigate('/freelance')
  }

  async function addTask(e) {
    e.preventDefault()
    const title = taskTitle.trim()
    if (!title) return

    const payload = { title, status: 'todo', client_id: clientId }
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
    const patch = { status: done ? 'done' : 'todo', done_at: done ? new Date().toISOString() : null }
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

  if (!client) return <p className="empty-text">Loading…</p>

  const today = todayISO()
  const projectIds = new Set(projects.map((project) => project.id))
  const clientEntries = entries.filter(
    (entry) => entry.client_id === clientId || projectIds.has(entry.project_id),
  )

  function rateForEntry(entry) {
    const project = projects.find((p) => p.id === entry.project_id)
    return project?.rate || client.rate || null
  }

  const minutes = clientEntries.reduce((sum, entry) => sum + entry.minutes, 0)
  const billableMin = clientEntries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.minutes, 0)
  const unbilledValue = clientEntries
    .filter((entry) => entry.billable && !entry.invoice_id)
    .reduce((sum, entry) => {
      const rate = rateForEntry(entry)
      return rate ? sum + (entry.minutes / 60) * Number(rate) : sum
    }, 0)

  const outstanding = invoices
    .filter((invoice) => invoice.status === 'sent')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)
  const paid = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

  function minutesForProject(id) {
    return entries.filter((entry) => entry.project_id === id).reduce((sum, e) => sum + e.minutes, 0)
  }

  const openTasks = tasks.filter((task) => task.status !== 'done').length
  const swatches = hexSwatches(client.brand_colors)

  const upcomingContent = [...content]
    .filter((item) => item.publish_date)
    .sort((a, b) => (a.publish_date < b.publish_date ? 1 : -1))

  return (
    <>
      <div className="card project-detail-head">
        <div className="project-scope-header">
          <div className="project-title-row">
            <span className={`brand-dot brand-${client.brand}`} />
            <h2>{client.name}</h2>
          </div>
          <Link to="/freelance" className="row-action-btn">
            All clients
          </Link>
        </div>

        <p className="list-row-sub task-meta">
          <span>{BRAND_LABEL[client.brand]}</span>
          <span>{STATUSES.find((row) => row.value === client.status)?.label || 'Active'}</span>
          {client.rate && <span>{formatMoney(client.rate)}/h</span>}
          {client.payment_terms && <span>{client.payment_terms}</span>}
        </p>

        <div className="review-grid">
          <div className="review-stat">
            <span className="review-stat-value">{formatHours(minutes)}</span>
            <span className="review-stat-label">Logged</span>
            {billableMin > 0 && (
              <span className="review-stat-sub">{formatHours(billableMin)} billable</span>
            )}
          </div>
          <div className="review-stat">
            <span className="review-stat-value">{unbilledValue > 0 ? formatMoney(unbilledValue) : '—'}</span>
            <span className="review-stat-label">Unbilled</span>
          </div>
          <div className="review-stat">
            <span className="review-stat-value">{outstanding > 0 ? formatMoney(outstanding) : '—'}</span>
            <span className="review-stat-label">Outstanding</span>
          </div>
          <div className="review-stat">
            <span className="review-stat-value">{paid > 0 ? formatMoney(paid) : '—'}</span>
            <span className="review-stat-label">Paid to date</span>
          </div>
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
            {option.key === 'tasks' && openTasks > 0 ? ` (${openTasks})` : ''}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="card">
          <div className="task-controls">
            <input
              type="text"
              className="inline-select"
              value={client.name}
              onChange={(e) => updateClient({ name: e.target.value })}
            />
            <select
              className="inline-select"
              value={client.brand}
              onChange={(e) => updateClient({ brand: e.target.value })}
            >
              {BRANDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="inline-select"
              value={client.status || 'active'}
              onChange={(e) => updateClient({ status: e.target.value })}
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
              value={client.rate || ''}
              placeholder="rate"
              onChange={(e) => updateClient({ rate: e.target.value ? Number(e.target.value) : null })}
            />
          </div>

          <TagPicker table="clients" id={client.id} />

          <h4>Who they are</h4>
          <div className="field-row">
            <input
              type="text"
              value={client.contact_name || ''}
              placeholder="contact name"
              onChange={(e) => updateClient({ contact_name: e.target.value || null })}
            />
            <input
              type="text"
              value={client.company || ''}
              placeholder="company / practice"
              onChange={(e) => updateClient({ company: e.target.value || null })}
            />
          </div>
          <div className="field-row">
            <input
              type="email"
              value={client.email || ''}
              placeholder="email"
              onChange={(e) => updateClient({ email: e.target.value || null })}
            />
            <input
              type="tel"
              value={client.phone || ''}
              placeholder="phone"
              onChange={(e) => updateClient({ phone: e.target.value || null })}
            />
          </div>

          <h4>Billing</h4>
          <div className="field-row">
            <input
              type="email"
              value={client.billing_email || ''}
              placeholder="billing email (if different)"
              onChange={(e) => updateClient({ billing_email: e.target.value || null })}
            />
            <input
              type="text"
              value={client.payment_terms || ''}
              placeholder="terms — e.g. net 14"
              onChange={(e) => updateClient({ payment_terms: e.target.value || null })}
            />
          </div>
          <textarea
            rows="2"
            value={client.address || ''}
            placeholder="billing address — goes on the invoice"
            onChange={(e) => updateClient({ address: e.target.value || null })}
          />

          <h4>Background</h4>
          <div className="field-row">
            <input
              type="url"
              value={client.website || ''}
              placeholder="website"
              onChange={(e) => updateClient({ website: e.target.value || null })}
            />
            <label className="filter-toggle">
              Working together since
              <input
                type="date"
                className="inline-select"
                value={client.started_on || ''}
                onChange={(e) => updateClient({ started_on: e.target.value || null })}
              />
            </label>
          </div>
          <input
            type="text"
            value={client.how_we_met || ''}
            placeholder="how you came to work together"
            onChange={(e) => updateClient({ how_we_met: e.target.value || null })}
          />

          <h4>Notes</h4>
          <textarea
            rows="4"
            value={client.notes || ''}
            placeholder="how they like to work, what to remember"
            onChange={(e) => updateClient({ notes: e.target.value || null })}
          />

          <div className="field-row">
            <button
              type="button"
              className="row-action-btn row-action-btn-danger"
              onClick={deleteClient}
            >
              Delete client
            </button>
          </div>
        </div>
      )}

      {tab === 'brand' && (
        <>
          <div className="card">
            <h3>Brand kit</h3>
            <p className="list-row-sub">Everything that keeps their look and voice consistent.</p>

            <h4>Colours</h4>
            {swatches.length > 0 && (
              <div className="color-picker-row">
                {swatches.map((hex) => (
                  <span
                    key={hex}
                    className="color-swatch"
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
              </div>
            )}
            <textarea
              rows="2"
              value={client.brand_colors || ''}
              placeholder="#3F6B5C sage, #B87333 clay — hex codes get a swatch"
              onChange={(e) => updateClient({ brand_colors: e.target.value || null })}
            />

            <h4>Fonts</h4>
            <textarea
              rows="2"
              value={client.brand_fonts || ''}
              placeholder="Headings: Lora · Body: Inter"
              onChange={(e) => updateClient({ brand_fonts: e.target.value || null })}
            />

            <h4>Voice &amp; tone</h4>
            <textarea
              rows="5"
              value={client.brand_voice || ''}
              placeholder="How they sound — words they use, words they avoid, the feeling to leave people with."
              onChange={(e) => updateClient({ brand_voice: e.target.value || null })}
            />
          </div>

          <ClientLinks
            clientId={clientId}
            categories={['asset']}
            defaultCategory="asset"
            title="Logos & brand files"
            hint="Links to logo folders, asset libraries, the brand guide."
          />
        </>
      )}

      {tab === 'content' && (
        <div className="card">
          <div className="project-scope-header">
            <h3>Content</h3>
            <Link to="/content" className="row-action-btn">
              Content pipeline
            </Link>
          </div>
          <p className="list-row-sub">
            {BRAND_LABEL[client.brand]} pieces from your pipeline. Stages are still driven from the
            Content page.
          </p>
          {upcomingContent.length === 0 ? (
            <EmptyState icon="🎬" title="No content yet">
              Anything tagged {BRAND_LABEL[client.brand]} in your Content pipeline will show here.
            </EmptyState>
          ) : (
            <ul className="list">
              {upcomingContent.map((item) => (
                <li key={item.id} className="list-row">
                  <div className="list-row-main task-main">
                    <Link to="/content" className="list-row-title project-link">
                      {item.title}
                    </Link>
                    <span className="list-row-sub task-meta">
                      <span>{item.stage}</span>
                      {item.platform && <span>{item.platform}</span>}
                      {item.publish_date && <span>{formatDueDate(item.publish_date)}</span>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card">
          <h3>Tasks</h3>
          <p className="list-row-sub">
            This client&apos;s list. These show in Tasks &amp; Projects and the Freelance Tasks
            board too.
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
              Add the next thing you owe this client.
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
      )}

      {tab === 'projects' && (
        <div className="card">
          <div className="project-scope-header">
            <h3>Projects</h3>
            <Link to="/freelance/projects" className="row-action-btn">
              All projects
            </Link>
          </div>
          {projects.length === 0 ? (
            <EmptyState icon="📁" title="No projects yet">
              Create a project for this client on the Projects tab — its time and tasks will
              roll up here.
            </EmptyState>
          ) : (
            <ul className="list">
              {projects.map((project) => (
                <li key={project.id} className="list-row">
                  <Link to={`/freelance/projects/${project.id}`} className="task-row-body client-card-link">
                    <div className="list-row-main task-main">
                      <span className="list-row-title">{project.name}</span>
                      <span className="list-row-sub task-meta">
                        <span>{PROJECT_STATUS[project.status] || project.status}</span>
                        <span>{formatHours(minutesForProject(project.id))} logged</span>
                        {project.rate && <span>{formatMoney(project.rate)}/h</span>}
                      </span>
                    </div>
                    <span className="row-action-btn">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="card">
          <div className="project-scope-header">
            <h3>Invoices</h3>
            <Link to="/freelance/invoices" className="row-action-btn">
              All invoices
            </Link>
          </div>
          {invoices.length === 0 ? (
            <EmptyState icon="🧾" title="No invoices yet">
              Invoices you raise for this client show here — raise one from the Invoices tab.
            </EmptyState>
          ) : (
            <ul className="list">
              {[...invoices]
                .sort((a, b) => ((a.issue_date || '') < (b.issue_date || '') ? 1 : -1))
                .map((invoice) => (
                  <li key={invoice.id} className="list-row">
                    <div className="list-row-main">
                      <span className="list-row-title">{formatMoney(invoice.amount)}</span>
                      <span className="list-row-sub task-meta">
                        {invoice.issue_date && <span>{invoice.issue_date}</span>}
                        {invoice.period_start && invoice.period_end && (
                          <span>
                            {invoice.period_start} – {invoice.period_end}
                          </span>
                        )}
                        <span
                          className={
                            invoice.status === 'paid'
                              ? 'priority-pill'
                              : invoice.status === 'sent'
                                ? 'task-overdue'
                                : undefined
                          }
                        >
                          {invoice.status}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'reference' && (
        <ClientLinks
          clientId={clientId}
          categories={['doc', 'folder', 'link', 'other']}
          defaultCategory="link"
          title="Reference & links"
          hint="Docs, shared folders, logins to ask for, anything you keep reaching for."
        />
      )}
    </>
  )
}

export default ClientDetail
