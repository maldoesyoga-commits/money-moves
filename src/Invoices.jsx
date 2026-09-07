import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatMoney } from './lib/format'
import { formatHours } from './lib/freelance'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'
import { report } from './lib/report'

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [unbilled, setUnbilled] = useState([])
  const [editingId, setEditingId] = useState(null)

  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [amount, setAmount] = useState('')
  const [number, setNumber] = useState('')

  const loadInvoices = useCallback(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('issue_date', { ascending: false })

    if (error) {
      report('Failed to load invoices', error)
      return
    }

    setInvoices(data)
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

    const { data: entryRows, error: entryError } = await supabase
      .from('time_entries')
      .select('*')
      .is('invoice_id', null)
      .eq('billable', true)

    if (entryError) {
      report('Failed to load unbilled time', entryError)
      return
    }

    setClients(clientRows)
    setProjects(projectRows)
    setUnbilled(entryRows)
  }, [])

  useEffect(() => {
    loadInvoices()
    loadRefs()
  }, [loadInvoices, loadRefs])

  function clientFor(id) {
    return clients.find((client) => client.id === id)
  }

  function projectFor(id) {
    return projects.find((project) => project.id === id)
  }

  function rateFor(entry) {
    const project = projectFor(entry.project_id)
    return project?.rate || clientFor(entry.client_id || project?.client_id)?.rate || null
  }

  // Unbilled billable time for the currently selected client/project.
  const matchingUnbilled = unbilled.filter((entry) => {
    if (projectId) return entry.project_id === projectId
    if (clientId) return entry.client_id === clientId
    return false
  })

  const unbilledMinutes = matchingUnbilled.reduce((sum, entry) => sum + entry.minutes, 0)
  const unbilledValue = matchingUnbilled.reduce((sum, entry) => {
    const rate = rateFor(entry)
    return rate ? sum + (entry.minutes / 60) * Number(rate) : sum
  }, 0)

  async function handleCreate(e) {
    e.preventDefault()

    const value = Number(amount)
    if (!value) return

    const payload = { amount: value, issue_date: todayISO() }
    if (clientId) payload.client_id = clientId
    if (projectId) payload.project_id = projectId
    if (number.trim()) payload.number = number.trim()

    const { data, error } = await supabase.from('invoices').insert(payload).select().single()

    if (error) {
      report('Failed to create invoice', error)
      return
    }

    // Attach the time this invoice covers, so it stops showing as unbilled.
    if (matchingUnbilled.length > 0) {
      const ids = matchingUnbilled.map((entry) => entry.id)
      const { error: linkError } = await supabase
        .from('time_entries')
        .update({ invoice_id: data.id })
        .in('id', ids)

      if (linkError) report('Failed to attach time entries', linkError)
    }

    setAmount('')
    setNumber('')
    loadInvoices()
    loadRefs()
  }

  async function updateInvoice(id, patch) {
    setInvoices((prev) => prev.map((invoice) => (invoice.id === id ? { ...invoice, ...patch } : invoice)))

    const { error } = await supabase.from('invoices').update(patch).eq('id', id)

    if (error) {
      report('Failed to update invoice', error)
      loadInvoices()
    }
  }

  function changeStatus(invoice, status) {
    const patch = { status }
    if (status === 'paid') patch.paid_date = invoice.paid_date || todayISO()
    if (status !== 'paid' && invoice.paid_date) patch.paid_date = null
    updateInvoice(invoice.id, patch)
  }

  async function deleteInvoice(id) {
    const { error: unlinkError } = await supabase
      .from('time_entries')
      .update({ invoice_id: null })
      .eq('invoice_id', id)

    if (unlinkError) report('Failed to release time entries', unlinkError)

    setInvoices((prev) => prev.filter((invoice) => invoice.id !== id))

    const { error } = await supabase.from('invoices').delete().eq('id', id)

    if (error) {
      report('Failed to delete invoice', error)
      loadInvoices()
    }

    loadRefs()
  }

  const outstanding = invoices
    .filter((invoice) => invoice.status === 'sent')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

  const awaitingIncome = invoices.filter(
    (invoice) => invoice.status === 'paid' && !invoice.logged_as_income,
  )

  return (
    <div className="card">
      <h2>Invoices</h2>

      <div className="total-row">
        <p>Outstanding</p>
        <span className="money">{formatMoney(outstanding)}</span>
      </div>

      <form onSubmit={handleCreate}>
        <div className="field-row">
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setProjectId('')
            }}
          >
            <option value="">No client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projects
              .filter((project) => !clientId || project.client_id === clientId)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
        </div>
        <div className="field-row">
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="invoice number"
          />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="amount"
          />
          <button type="submit">Create invoice</button>
        </div>

        {matchingUnbilled.length > 0 && (
          <div className="unbilled-hint">
            <p className="list-row-sub">
              {formatHours(unbilledMinutes)} unbilled here — worth {formatMoney(unbilledValue)}.
            </p>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => setAmount(unbilledValue.toFixed(2))}
            >
              Use that amount
            </button>
          </div>
        )}
      </form>

      {awaitingIncome.length > 0 && (
        <div className="income-nudge">
          <p className="list-row-sub">
            {awaitingIncome.length} paid invoice{awaitingIncome.length > 1 ? 's' : ''} not yet run
            through Money Moves.
          </p>
          <Link to="/money/income" className="row-action-btn">
            Open Income
          </Link>
        </div>
      )}

      {invoices.length === 0 ? (
        <EmptyState icon="🧾" title="No invoices yet">
          Pick a client above and Homestead totals up their unbilled time for you.
          Mark one paid and it reminds you to run it through Money Moves.
        </EmptyState>
      ) : (
        <ul className="list">
          {invoices.map((invoice) => {
            const editing = editingId === invoice.id
            const late = invoice.status === 'sent' && isOverdue(invoice.due_date)

            return (
              <li key={invoice.id} className="list-row project-row">
                <div className="task-row-body">
                  <div className="list-row-main task-main">
                    <span className="list-row-title">
                      {invoice.link ? (
                        <a
                          href={invoice.link}
                          target="_blank"
                          rel="noreferrer"
                          className="project-link"
                        >
                          {invoice.number || 'Invoice'}
                        </a>
                      ) : (
                        invoice.number || 'Invoice'
                      )}
                    </span>
                    <span className="list-row-sub task-meta">
                      <span>{clientFor(invoice.client_id)?.name || 'No client'}</span>
                      <span className={`priority-pill status-${invoice.status}`}>
                        {STATUSES.find((s) => s.value === invoice.status)?.label}
                      </span>
                      {invoice.due_date && (
                        <span className={late ? 'task-overdue' : undefined}>
                          due {formatDueDate(invoice.due_date)}
                        </span>
                      )}
                      {invoice.status === 'paid' && invoice.paid_date && (
                        <span>paid {invoice.paid_date}</span>
                      )}
                    </span>
                  </div>
                  <span className="money">{formatMoney(invoice.amount)}</span>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setEditingId(editing ? null : invoice.id)}
                  >
                    {editing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {editing && (
                  <div className="learning-detail">
                    <div className="task-controls">
                      <select
                        className="inline-select"
                        value={invoice.status}
                        onChange={(e) => changeStatus(invoice, e.target.value)}
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
                        className="inline-select"
                        value={invoice.amount}
                        onChange={(e) =>
                          updateInvoice(invoice.id, { amount: Number(e.target.value) || 0 })
                        }
                      />
                      <input
                        type="date"
                        className="inline-select"
                        value={invoice.due_date || ''}
                        onChange={(e) =>
                          updateInvoice(invoice.id, { due_date: e.target.value || null })
                        }
                      />
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteInvoice(invoice.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <input
                      type="url"
                      value={invoice.link || ''}
                      placeholder="link to the invoice PDF"
                      onChange={(e) => updateInvoice(invoice.id, { link: e.target.value || null })}
                    />

                    {invoice.status === 'paid' && (
                      <label className="filter-toggle">
                        <input
                          type="checkbox"
                          checked={invoice.logged_as_income}
                          onChange={(e) =>
                            updateInvoice(invoice.id, { logged_as_income: e.target.checked })
                          }
                        />
                        Logged in Money Moves
                      </label>
                    )}
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

export default Invoices
