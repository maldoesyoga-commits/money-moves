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
  const [amount, setAmount] = useState('')
  const [number, setNumber] = useState('')
  // An invoice covers a stretch of time for one client — the project is a
  // level of detail below that, and a client's invoice usually spans several.
  const [from, setFrom] = useState(`${todayISO().slice(0, 7)}-01`)
  const [to, setTo] = useState(todayISO())
  const [allEntries, setAllEntries] = useState([])

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
      .order('entry_date')

    if (entryError) {
      report('Failed to load time entries', entryError)
      return
    }

    setClients(clientRows)
    setProjects(projectRows)
    setAllEntries(entryRows)
    setUnbilled(entryRows.filter((entry) => entry.billable && !entry.invoice_id))
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

  // The sessions this invoice will cover: unbilled billable time for the
  // chosen client, inside the chosen dates. An entry logged against a project
  // counts for that project's client even if it has no client_id of its own.
  function clientOf(entry) {
    return entry.client_id || projectFor(entry.project_id)?.client_id || null
  }

  const matchingUnbilled = unbilled.filter((entry) => {
    if (!clientId) return false
    if (clientOf(entry) !== clientId) return false
    if (from && entry.entry_date < from) return false
    if (to && entry.entry_date > to) return false
    return true
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

    const payload = {
      amount: value,
      issue_date: todayISO(),
      period_start: from || null,
      period_end: to || null,
    }
    if (clientId) payload.client_id = clientId
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
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="invoice number"
          />
        </div>

        <div className="field-row">
          <label className="filter-toggle">
            From
            <input
              type="date"
              className="inline-select"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="filter-toggle">
            To
            <input
              type="date"
              className="inline-select"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => {
              const month = todayISO().slice(0, 7)
              setFrom(`${month}-01`)
              setTo(todayISO())
            }}
          >
            This month
          </button>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => {
              const date = new Date(`${todayISO().slice(0, 7)}-01T12:00:00`)
              date.setMonth(date.getMonth() - 1)
              const month = date.toISOString().slice(0, 7)
              const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
              setFrom(`${month}-01`)
              setTo(end.toISOString().slice(0, 10))
            }}
          >
            Last month
          </button>
        </div>

        {clientId && (
          <div className="card invoice-preview">
            <div className="project-scope-header">
              <h3>Sessions in this window</h3>
              <span className="list-row-sub">
                {formatHours(unbilledMinutes)} · {formatMoney(unbilledValue)}
              </span>
            </div>

            {matchingUnbilled.length === 0 ? (
              <p className="empty-text">
                No unbilled time for this client between those dates.
              </p>
            ) : (
              <ul className="list">
                {matchingUnbilled.map((entry) => {
                  const rate = rateFor(entry)

                  return (
                    <li key={entry.id} className="list-row">
                      <div className="list-row-main">
                        <span className="list-row-title">{entry.notes || 'Session'}</span>
                        <span className="list-row-sub task-meta">
                          <span>{entry.entry_date}</span>
                          <span>{formatHours(entry.minutes)}</span>
                          {projectFor(entry.project_id) && (
                            <span>{projectFor(entry.project_id).name}</span>
                          )}
                          {rate && <span>{formatMoney(rate)}/h</span>}
                        </span>
                      </div>
                      {rate && (
                        <span className="money">
                          {formatMoney((entry.minutes / 60) * Number(rate))}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        <div className="field-row">
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="amount"
          />
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setAmount(unbilledValue.toFixed(2))}
            disabled={unbilledValue === 0}
          >
            Use tracked time
          </button>
          <button type="submit">Create invoice</button>
        </div>

        <p className="list-row-sub">
          Creating it attaches every session above, so they stop showing as unbilled and
          stay listed on the invoice.
        </p>
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
                      {invoice.period_start && (
                        <span>
                          {invoice.period_start} → {invoice.period_end}
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
                    {allEntries.filter((entry) => entry.invoice_id === invoice.id).length > 0 && (
                      <>
                        <h4>Sessions on this invoice</h4>
                        <ul className="list">
                          {allEntries
                            .filter((entry) => entry.invoice_id === invoice.id)
                            .map((entry) => {
                              const rate = rateFor(entry)

                              return (
                                <li key={entry.id} className="list-row">
                                  <div className="list-row-main">
                                    <span className="list-row-title">
                                      {entry.notes || 'Session'}
                                    </span>
                                    <span className="list-row-sub task-meta">
                                      <span>{entry.entry_date}</span>
                                      <span>{formatHours(entry.minutes)}</span>
                                      {projectFor(entry.project_id) && (
                                        <span>{projectFor(entry.project_id).name}</span>
                                      )}
                                    </span>
                                  </div>
                                  {rate && (
                                    <span className="money">
                                      {formatMoney((entry.minutes / 60) * Number(rate))}
                                    </span>
                                  )}
                                </li>
                              )
                            })}
                        </ul>
                      </>
                    )}

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
