import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatMoney } from './lib/format'
import { BRANDS, BRAND_LABEL, formatHours } from './lib/freelance'
import { report } from './lib/report'

function Clients() {
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({})
  const [showPast, setShowPast] = useState(false)

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('cm')
  const [rate, setRate] = useState('')

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name')

    if (error) {
      report('Failed to load clients', error)
      return
    }

    setClients(data)
  }, [])

  const loadStats = useCallback(async () => {
    const { data: entries, error: entryError } = await supabase
      .from('time_entries')
      .select('client_id, minutes')

    if (entryError) {
      report('Failed to load time entries', entryError)
      return
    }

    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('client_id, amount, status')

    if (invoiceError) {
      report('Failed to load invoices', invoiceError)
      return
    }

    const next = {}
    entries.forEach((entry) => {
      if (!entry.client_id) return
      next[entry.client_id] = next[entry.client_id] || { minutes: 0, outstanding: 0, paid: 0 }
      next[entry.client_id].minutes += entry.minutes
    })
    invoices.forEach((invoice) => {
      if (!invoice.client_id) return
      next[invoice.client_id] = next[invoice.client_id] || { minutes: 0, outstanding: 0, paid: 0 }
      if (invoice.status === 'paid') next[invoice.client_id].paid += Number(invoice.amount)
      else if (invoice.status === 'sent') next[invoice.client_id].outstanding += Number(invoice.amount)
    })

    setStats(next)
  }, [])

  useEffect(() => {
    loadClients()
    loadStats()
  }, [loadClients, loadStats])

  async function handleCreate(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed, brand }
    if (rate) payload.rate = Number(rate)

    const { error } = await supabase.from('clients').insert(payload)

    if (error) {
      report('Failed to create client', error)
      return
    }

    setName('')
    setRate('')
    loadClients()
  }

  const visible = clients.filter((client) => showPast || client.status !== 'past')

  return (
    <div className="card">
      <h2>Clients</h2>

      <form onSubmit={handleCreate}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="client name"
          />
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {BRANDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="hourly rate"
          />
          <button type="submit">Add client</button>
        </div>
      </form>

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Show past clients
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🤝" title="No clients yet">
          Add whoever pays you — set their hourly rate here and time entries price
          themselves. Open a client to see their whole dashboard.
        </EmptyState>
      ) : (
        <ul className="list">
          {visible.map((client) => {
            const stat = stats[client.id] || { minutes: 0, outstanding: 0, paid: 0 }

            return (
              <li key={client.id} className="list-row project-row">
                <Link to={`/freelance/clients/${client.id}`} className="task-row-body client-card-link">
                  <span className={`brand-dot brand-${client.brand}`} />
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{client.name}</span>
                    <span className="list-row-sub task-meta">
                      <span>{BRAND_LABEL[client.brand]}</span>
                      {client.rate && <span>{formatMoney(client.rate)}/h</span>}
                      {client.company && <span>{client.company}</span>}
                      {client.payment_terms && <span>{client.payment_terms}</span>}
                      {stat.minutes > 0 && <span>{formatHours(stat.minutes)} logged</span>}
                      {stat.outstanding > 0 && (
                        <span className="task-overdue">{formatMoney(stat.outstanding)} owing</span>
                      )}
                    </span>
                  </div>
                  <span className="row-action-btn">Open →</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Clients
