import { useCallback, useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import TagPicker from './TagPicker'
import { formatMoney } from './lib/format'
import { formatHours, BRANDS, BRAND_LABEL } from './lib/freelance'
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
  { key: 'projects', label: 'Projects' },
  { key: 'invoices', label: 'Invoices' },
]

function ClientDetail() {
  const { clientId } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [tab, setTab] = useState('overview')

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

    const [{ data: projectRows }, { data: entryRows }, { data: invoiceRows }] = await Promise.all([
      supabase.from('freelance_projects').select('*').eq('client_id', clientId).order('name'),
      supabase.from('time_entries').select('*'),
      supabase.from('invoices').select('*').eq('client_id', clientId),
    ])

    setProjects(projectRows || [])
    setEntries(entryRows || [])
    setInvoices(invoiceRows || [])
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

  if (!client) return <p className="empty-text">Loading…</p>

  const projectIds = new Set(projects.map((project) => project.id))
  const clientEntries = entries.filter(
    (entry) => entry.client_id === clientId || projectIds.has(entry.project_id),
  )
  const minutes = clientEntries.reduce((sum, entry) => sum + entry.minutes, 0)

  const outstanding = invoices
    .filter((invoice) => invoice.status === 'sent')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)
  const paid = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

  function minutesForProject(id) {
    return entries.filter((entry) => entry.project_id === id).reduce((sum, e) => sum + e.minutes, 0)
  }

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
              onChange={(e) =>
                updateClient({ rate: e.target.value ? Number(e.target.value) : null })
              }
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
    </>
  )
}

export default ClientDetail
