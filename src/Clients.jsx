import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import TagPicker from './TagPicker'
import EmptyState from './EmptyState'
import { formatMoney } from './lib/format'
import { BRANDS, BRAND_LABEL, formatHours } from './lib/freelance'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'past', label: 'Past' },
]

function Clients() {
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({})
  const [showPast, setShowPast] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('cm')
  const [rate, setRate] = useState('')

  const loadClients = useCallback(async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name')

    if (error) {
      console.log('Failed to load clients', error.message)
      return
    }

    setClients(data)
  }, [])

  const loadStats = useCallback(async () => {
    const { data: entries, error: entryError } = await supabase
      .from('time_entries')
      .select('client_id, minutes')

    if (entryError) {
      console.log('Failed to load time entries', entryError.message)
      return
    }

    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('client_id, amount, status')

    if (invoiceError) {
      console.log('Failed to load invoices', invoiceError.message)
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
      console.log('Failed to create client', error.message)
      return
    }

    setName('')
    setRate('')
    loadClients()
  }

  async function updateClient(id, patch) {
    setClients((prev) => prev.map((client) => (client.id === id ? { ...client, ...patch } : client)))

    const { error } = await supabase.from('clients').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update client', error.message)
      loadClients()
    }
  }

  async function deleteClient(id) {
    setClients((prev) => prev.filter((client) => client.id !== id))

    const { error } = await supabase.from('clients').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete client', error.message)
      loadClients()
    }
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
          themselves. Brand tag keeps CM, HH and OM work apart.
        </EmptyState>
      ) : (
        <ul className="list">
          {visible.map((client) => {
            const editing = editingId === client.id
            const stat = stats[client.id] || { minutes: 0, outstanding: 0, paid: 0 }

            return (
              <li key={client.id} className="list-row project-row">
                <div className="task-row-body">
                  <span className={`brand-dot brand-${client.brand}`} />
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{client.name}</span>
                    <span className="list-row-sub task-meta">
                      <span>{BRAND_LABEL[client.brand]}</span>
                      {client.rate && <span>{formatMoney(client.rate)}/h</span>}
                      {stat.minutes > 0 && <span>{formatHours(stat.minutes)} logged</span>}
                      {stat.outstanding > 0 && (
                        <span className="task-overdue">{formatMoney(stat.outstanding)} owing</span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setEditingId(editing ? null : client.id)}
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
                        value={client.name}
                        onChange={(e) => updateClient(client.id, { name: e.target.value })}
                      />
                      <select
                        className="inline-select"
                        value={client.brand}
                        onChange={(e) => updateClient(client.id, { brand: e.target.value })}
                      >
                        {BRANDS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="inline-select"
                        value={client.status}
                        onChange={(e) => updateClient(client.id, { status: e.target.value })}
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
                        value={client.rate || ''}
                        placeholder="rate"
                        onChange={(e) =>
                          updateClient(client.id, { rate: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteClient(client.id)}
                      >
                        Delete
                      </button>
                      <TagPicker table="clients" id={client.id} />
                    </div>
                    <input
                      type="text"
                      value={client.contact_name || ''}
                      placeholder="contact name"
                      onChange={(e) =>
                        updateClient(client.id, { contact_name: e.target.value || null })
                      }
                    />
                    <input
                      type="email"
                      value={client.email || ''}
                      placeholder="email"
                      onChange={(e) => updateClient(client.id, { email: e.target.value || null })}
                    />
                    <textarea
                      rows="2"
                      value={client.notes || ''}
                      placeholder="notes"
                      onChange={(e) => updateClient(client.id, { notes: e.target.value || null })}
                    />
                    {stat.paid > 0 && (
                      <p className="list-row-sub">{formatMoney(stat.paid)} paid to date.</p>
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

export default Clients
