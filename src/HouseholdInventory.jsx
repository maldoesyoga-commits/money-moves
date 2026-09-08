import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { warrantyState } from './lib/household'
import { report } from './lib/report'

const CATEGORIES = [
  'Appliance',
  'Electronics',
  'Furniture',
  'Tools',
  'Kitchen',
  'Outdoor',
  'Other',
]

function HouseholdInventory() {
  const [items, setItems] = useState([])
  const [openId, setOpenId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('household_items')
      .select('*')
      .order('location', { nullsFirst: false })
      .order('name')

    if (error) {
      report('Failed to load inventory', error)
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

    const payload = { name: trimmed }
    if (location.trim()) payload.location = location.trim()
    if (category) payload.category = category

    const { error } = await supabase.from('household_items').insert(payload)

    if (error) {
      report('Failed to add item', error)
      return
    }

    setName('')
    load()
  }

  async function updateItem(id, patch) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))

    const { error } = await supabase.from('household_items').update(patch).eq('id', id)

    if (error) {
      report('Failed to update item', error)
      load()
    }
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((item) => item.id !== id))

    const { error } = await supabase.from('household_items').delete().eq('id', id)

    if (error) {
      report('Failed to delete item', error)
      load()
    }
  }

  const locations = [...new Set(items.map((item) => item.location).filter(Boolean))].sort()

  const visible = items.filter((item) => {
    if (!showArchived && item.archived) return false
    if (locationFilter !== 'all') {
      if (locationFilter === 'none' ? item.location : item.location !== locationFilter) {
        return false
      }
    }
    if (search) {
      const haystack = [item.name, item.brand, item.model, item.serial_number, item.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  })

  const totalValue = visible.reduce(
    (sum, item) => sum + Number(item.purchase_price || 0) * (item.quantity || 1),
    0,
  )

  return (
    <>
      <div className="card">
        <h2>Add an item</h2>
        <form onSubmit={addItem}>
          <div className="field-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="what it is — e.g. Washing machine"
            />
            <input
              type="text"
              className="inline-select"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="where it lives"
              list="household-locations"
            />
            <select
              className="inline-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">No category</option>
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button type="submit">Add</button>
          </div>
        </form>
        <datalist id="household-locations">
          {locations.map((place) => (
            <option key={place} value={place} />
          ))}
        </datalist>
        <p className="list-row-sub">
          Serial and model numbers are the bit you can never find when something breaks
          or a claim needs filing — open an item and fill them in once.
        </p>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Inventory</h2>
          <span className="list-row-sub">
            {visible.length} {visible.length === 1 ? 'item' : 'items'}
            {totalValue > 0 && ` · $${totalValue.toFixed(2)}`}
          </span>
        </div>

        <div className="transaction-filter-bar">
          <input
            type="search"
            className="inline-select"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name, brand, model, serial"
          />
          {locations.length > 0 && (
            <label className="filter-toggle">
              Where
              <select
                className="inline-select"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="all">Everywhere</option>
                <option value="none">No location</option>
                {locations.map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
              </select>
            </label>
          )}
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
          <EmptyState icon="📦" title="Nothing logged yet">
            Start with the things that have manuals or warranties — appliances, tools,
            electronics. Those are the ones you&apos;ll want the paperwork for later.
          </EmptyState>
        ) : (
          <ul className="list">
            {visible.map((item) => {
              const open = openId === item.id
              const warranty = warrantyState(item)

              return (
                <li key={item.id} className={`list-row${item.archived ? ' task-done' : ''}`}>
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title task-title">
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="priority-pill">×{item.quantity}</span>
                        )}
                      </span>
                      <span className="list-row-sub task-meta">
                        {item.location && <span>{item.location}</span>}
                        {item.category && <span>{item.category}</span>}
                        {item.brand && <span>{item.brand}</span>}
                        {item.model && <span>model {item.model}</span>}
                        {warranty && <span className={warranty.tone}>{warranty.label}</span>}
                      </span>
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
                      <input
                        type="text"
                        className="inline-select"
                        value={item.location || ''}
                        placeholder="location"
                        list="household-locations"
                        onChange={(e) =>
                          updateItem(item.id, { location: e.target.value || null })
                        }
                      />
                      <select
                        className="inline-select"
                        value={item.category || ''}
                        onChange={(e) =>
                          updateItem(item.id, { category: e.target.value || null })
                        }
                      >
                        <option value="">No category</option>
                        {CATEGORIES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        className="target-input"
                        value={item.quantity}
                        title="Quantity"
                        onChange={(e) =>
                          updateItem(item.id, { quantity: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                      <input
                        type="text"
                        className="inline-select"
                        value={item.brand || ''}
                        placeholder="brand"
                        onChange={(e) => updateItem(item.id, { brand: e.target.value || null })}
                      />
                      <input
                        type="text"
                        className="inline-select"
                        value={item.model || ''}
                        placeholder="model number"
                        onChange={(e) => updateItem(item.id, { model: e.target.value || null })}
                      />
                      <input
                        type="text"
                        className="inline-select"
                        value={item.serial_number || ''}
                        placeholder="serial number"
                        onChange={(e) =>
                          updateItem(item.id, { serial_number: e.target.value || null })
                        }
                      />
                      <label className="filter-toggle">
                        Bought
                        <input
                          type="date"
                          className="inline-select"
                          value={item.purchase_date || ''}
                          onChange={(e) =>
                            updateItem(item.id, { purchase_date: e.target.value || null })
                          }
                        />
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="target-input"
                        value={item.purchase_price || ''}
                        placeholder="price"
                        onChange={(e) =>
                          updateItem(item.id, {
                            purchase_price: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                      <label className="filter-toggle">
                        Warranty to
                        <input
                          type="date"
                          className="inline-select"
                          value={item.warranty_until || ''}
                          onChange={(e) =>
                            updateItem(item.id, { warranty_until: e.target.value || null })
                          }
                        />
                      </label>
                      <input
                        type="text"
                        className="inline-select"
                        value={item.notes || ''}
                        placeholder="notes"
                        onChange={(e) => updateItem(item.id, { notes: e.target.value || null })}
                      />
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => updateItem(item.id, { archived: !item.archived })}
                      >
                        {item.archived ? 'Restore' : 'Archive'}
                      </button>
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
        )}
      </div>
    </>
  )
}

export default HouseholdInventory
