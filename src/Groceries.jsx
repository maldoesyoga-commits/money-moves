import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatMoney } from './lib/format'
import FoodBudget from './FoodBudget'

const AISLES = [
  { value: 'produce', label: 'Produce' },
  { value: 'protein', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
]

function Groceries() {
  const [items, setItems] = useState([])
  const [showGot, setShowGot] = useState(false)

  const [name, setName] = useState('')
  const [aisle, setAisle] = useState('produce')
  const [cost, setCost] = useState('')

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('grocery_items')
      .select('*')
      .order('created_at')

    if (error) {
      console.log('Failed to load grocery items', error.message)
      return
    }

    setItems(data)
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed, aisle }
    if (cost) payload.est_cost = Number(cost)

    const { error } = await supabase.from('grocery_items').insert(payload)

    if (error) {
      console.log('Failed to add grocery item', error.message)
      return
    }

    setName('')
    setCost('')
    loadItems()
  }

  async function updateItem(id, patch) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))

    const { error } = await supabase.from('grocery_items').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update grocery item', error.message)
      loadItems()
    }
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((item) => item.id !== id))

    const { error } = await supabase.from('grocery_items').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete grocery item', error.message)
      loadItems()
    }
  }

  async function clearGot() {
    const gotIds = items.filter((item) => item.got_it).map((item) => item.id)
    if (gotIds.length === 0) return

    setItems((prev) => prev.filter((item) => !item.got_it))

    const { error } = await supabase.from('grocery_items').delete().in('id', gotIds)

    if (error) {
      console.log('Failed to clear list', error.message)
      loadItems()
    }
  }

  const visible = items.filter((item) => showGot || !item.got_it)
  const outstanding = items.filter((item) => !item.got_it)
  const estimate = outstanding.reduce((sum, item) => sum + Number(item.est_cost || 0), 0)

  return (
    <div className="card">
      <div className="project-scope-header">
        <h2>Groceries</h2>
        <Link to="/money/transactions" className="row-action-btn">
          Food spending
        </Link>
      </div>

      <div className="total-row">
        <p>
          {outstanding.length} item{outstanding.length === 1 ? '' : 's'} to get
        </p>
        {estimate > 0 && <span className="money">≈ {formatMoney(estimate)}</span>}
      </div>

      <FoodBudget estimate={estimate} />

      <form className="quick-add" onSubmit={handleAdd}>
        <input
          type="text"
          className="quick-add-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add to the list"
        />
        <div className="field-row">
          <select value={aisle} onChange={(e) => setAisle(e.target.value)}>
            {AISLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="est. cost"
          />
          <button type="submit">Add</button>
        </div>
      </form>

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input type="checkbox" checked={showGot} onChange={(e) => setShowGot(e.target.checked)} />
          Show what I&apos;ve got
        </label>
        <button type="button" className="row-action-btn" onClick={clearGot}>
          Clear picked up
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🛒" title="List is empty">
          Add items above, or send a meal&apos;s ingredients over from the Meals tab.
          Tick things off as you shop.
        </EmptyState>
      ) : (
        AISLES.map((group) => {
          const groupItems = visible.filter((item) => item.aisle === group.value)
          if (groupItems.length === 0) return null

          return (
            <div className="category-group-block" key={group.value}>
              <h3>{group.label}</h3>
              <ul className="list">
                {groupItems.map((item) => (
                  <li
                    key={item.id}
                    className={`list-row task-row${item.got_it ? ' task-done' : ''}`}
                  >
                    <div className="task-row-body">
                      <button
                        type="button"
                        className={`task-check${item.got_it ? ' checked' : ''}`}
                        onClick={() => updateItem(item.id, { got_it: !item.got_it })}
                        aria-label={item.got_it ? 'Put back' : 'Got it'}
                      >
                        {item.got_it ? '✓' : ''}
                      </button>
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">{item.name}</span>
                        {item.quantity && <span className="list-row-sub">{item.quantity}</span>}
                      </div>
                      {item.est_cost && <span className="money">{formatMoney(item.est_cost)}</span>}
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })
      )}
    </div>
  )
}

export default Groceries
