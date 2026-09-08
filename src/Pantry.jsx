import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { AISLES, STATUSES, statusTone, onShoppingList } from './lib/pantry'
import { report } from './lib/report'

const AISLE_LABEL = Object.fromEntries(AISLES.map((aisle) => [aisle.value, aisle.label]))

function Pantry() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [aisleFilter, setAisleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState(null)

  const [name, setName] = useState('')
  const [aisle, setAisle] = useState('produce')
  const [status, setStatus] = useState('have')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .order('aisle')
      .order('name')

    if (error) {
      report('Failed to load the pantry', error)
      return
    }

    setItems(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addItem(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase.from('pantry_items').insert({
      name: trimmed,
      aisle,
      status,
    })

    if (error) {
      // The unique index is what keeps this list from filling up with
      // near-duplicates — say so plainly rather than failing silently.
      report(
        error.code === '23505' ? `${trimmed} is already on the list` : 'Failed to add item',
        error,
      )
      return
    }

    setName('')
    load()
  }

  async function updateItem(id, patch) {
    const next = { ...patch, updated_at: new Date().toISOString() }

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)))

    const { error } = await supabase.from('pantry_items').update(next).eq('id', id)

    if (error) {
      report('Failed to update item', error)
      load()
    }
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((item) => item.id !== id))

    const { error } = await supabase.from('pantry_items').delete().eq('id', id)

    if (error) {
      report('Failed to delete item', error)
      load()
    }
  }

  const visible = items.filter((item) => {
    if (aisleFilter !== 'all' && item.aisle !== aisleFilter) return false
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = {
    have: items.filter((item) => item.status === 'have').length,
    low: items.filter((item) => item.status === 'low').length,
    out: items.filter((item) => item.status === 'out').length,
  }
  const shopping = items.filter(onShoppingList).length

  return (
    <>
      <div className="review-grid">
        <div className="review-stat">
          <span className="review-stat-value">{counts.have}</span>
          <span className="review-stat-label">In stock</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{counts.low}</span>
          <span className="review-stat-label">Running low</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{counts.out}</span>
          <span className="review-stat-label">Out</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{shopping}</span>
          <span className="review-stat-label">On the list</span>
        </div>
      </div>

      <div className="card">
        <h2>Add an ingredient</h2>
        <form className="field-row" onSubmit={addItem}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ingredient"
          />
          <select className="inline-select" value={aisle} onChange={(e) => setAisle(e.target.value)}>
            {AISLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="inline-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit">Add</button>
        </form>
        <p className="list-row-sub">
          Everything you cook with goes on here once and stays. What changes is the
          status — that&apos;s what the shopping list reads, and what a recipe checks
          against.
        </p>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Pantry</h2>
          <span className="list-row-sub">{visible.length}</span>
        </div>

        <div className="transaction-filter-bar">
          <input
            type="search"
            className="inline-select"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search"
          />
          <label className="filter-toggle">
            Aisle
            <select
              className="inline-select"
              value={aisleFilter}
              onChange={(e) => setAisleFilter(e.target.value)}
            >
              <option value="all">All</option>
              {AISLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-toggle">
            Status
            <select
              className="inline-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="🧂" title="Nothing in the pantry yet">
            Add what you cook with — the staples first. Once it&apos;s here, tapping
            Have/Low/Out is the only upkeep it needs.
          </EmptyState>
        ) : (
          AISLES.map((group) => {
            const groupItems = visible.filter((item) => item.aisle === group.value)
            if (groupItems.length === 0) return null

            return (
              <div className="category-group-block" key={group.value}>
                <h3>{group.label}</h3>
                <ul className="list">
                  {groupItems.map((item) => {
                    const open = openId === item.id

                    return (
                      <li key={item.id} className="list-row">
                        <div className="task-row-body">
                          <div className="list-row-main task-main">
                            <span className="list-row-title task-title">
                              {item.name}
                              {item.staple && <span className="priority-pill">staple</span>}
                            </span>
                            <span className="list-row-sub task-meta">
                              <span className={statusTone(item.status)}>
                                {STATUSES.find((s) => s.value === item.status)?.label}
                              </span>
                              {item.needed && <span className="task-overdue">needed</span>}
                              {item.unit && <span>{item.unit}</span>}
                            </span>
                          </div>

                          <div className="stage-nudge">
                            {STATUSES.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="row-action-btn"
                                style={
                                  item.status === option.value
                                    ? { background: 'var(--sage)', color: '#fff' }
                                    : undefined
                                }
                                onClick={() =>
                                  updateItem(item.id, {
                                    status: option.value,
                                    // Marking something back in stock takes it off
                                    // the list, whatever flagged it.
                                    needed: option.value === 'have' ? false : item.needed,
                                    needed_note: option.value === 'have' ? null : item.needed_note,
                                  })
                                }
                              >
                                {option.short}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => setOpenId(open ? null : item.id)}
                          >
                            {open ? 'Close' : 'Edit'}
                          </button>
                        </div>

                        {open && (
                          <div className="task-controls">
                            <input
                              type="text"
                              className="inline-select"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            />
                            <select
                              className="inline-select"
                              value={item.aisle}
                              onChange={(e) => updateItem(item.id, { aisle: e.target.value })}
                            >
                              {AISLES.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              className="inline-select"
                              value={item.unit || ''}
                              placeholder="usual size — e.g. 500g bag"
                              onChange={(e) => updateItem(item.id, { unit: e.target.value || null })}
                            />
                            <input
                              type="number"
                              step="0.01"
                              className="target-input"
                              value={item.est_cost || ''}
                              placeholder="cost"
                              onChange={(e) =>
                                updateItem(item.id, {
                                  est_cost: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            />
                            <label className="filter-toggle">
                              <input
                                type="checkbox"
                                checked={item.staple}
                                onChange={(e) => updateItem(item.id, { staple: e.target.checked })}
                              />
                              Staple
                            </label>
                            <button
                              type="button"
                              className="row-action-btn row-action-btn-danger"
                              onClick={() => deleteItem(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

export default Pantry
