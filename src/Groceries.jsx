import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatMoney } from './lib/format'
import FoodBudget from './FoodBudget'
import { AISLES, STATUSES, statusTone, onShoppingList, ensurePantryItem } from './lib/pantry'
import { report } from './lib/report'

// The shopping list is a view of the pantry, not a list of its own. Nothing is
// created or deleted here — picking something up flips its status back to
// "have", which is what takes it off the list.
function Groceries() {
  const [items, setItems] = useState([])
  const [showAllLow, setShowAllLow] = useState(false)
  const [name, setName] = useState('')
  const [aisle, setAisle] = useState('produce')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .order('aisle')
      .order('name')

    if (error) {
      report('Failed to load the shopping list', error)
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

    const { item, created, error } = await ensurePantryItem(trimmed, { aisle, status: 'out' })

    if (error) {
      report('Failed to add item', error)
      return
    }

    // Already in the pantry — mark it needed rather than making a second row.
    if (!created && item.status === 'have') {
      await supabase.from('pantry_items').update({ status: 'out' }).eq('id', item.id)
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

  function gotIt(item) {
    updateItem(item.id, { status: 'have', needed: false, needed_note: null })
  }

  async function clearFlags() {
    const flagged = items.filter((item) => item.needed).map((item) => item.id)
    if (flagged.length === 0) return

    setItems((prev) => prev.map((item) => ({ ...item, needed: false, needed_note: null })))

    const { error } = await supabase
      .from('pantry_items')
      .update({ needed: false, needed_note: null })
      .in('id', flagged)

    if (error) {
      report('Failed to clear recipe flags', error)
      load()
    }
  }

  const list = items.filter((item) =>
    showAllLow ? onShoppingList(item) || item.status === 'low' : onShoppingList(item),
  )
  const estimate = list.reduce((sum, item) => sum + Number(item.est_cost || 0), 0)
  const flagged = items.filter((item) => item.needed).length

  return (
    <div className="card">
      <div className="project-scope-header">
        <h2>Shopping list</h2>
        <Link to="/money/transactions" className="row-action-btn">
          Food spending
        </Link>
      </div>

      <div className="total-row">
        <p>
          {list.length} item{list.length === 1 ? '' : 's'} to get
          {flagged > 0 && ` · ${flagged} flagged by a recipe`}
        </p>
        {estimate > 0 && <span className="money">≈ {formatMoney(estimate)}</span>}
      </div>

      <FoodBudget estimate={estimate} />

      <form className="field-row" onSubmit={addItem}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="need something that isn't here?"
        />
        <select className="inline-select" value={aisle} onChange={(e) => setAisle(e.target.value)}>
          {AISLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>

      <p className="list-row-sub">
        Adding here puts it in the pantry too, marked Out. Nothing gets deleted when you
        shop — ticking an item sets it back to Have, which is what takes it off this
        list.
      </p>

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showAllLow}
            onChange={(e) => setShowAllLow(e.target.checked)}
          />
          Include everything running low
        </label>
        {flagged > 0 && (
          <button type="button" className="row-action-btn" onClick={clearFlags}>
            Clear recipe flags
          </button>
        )}
        <Link to="/household/meals/pantry" className="row-action-btn">
          Edit pantry
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="🛒" title="Nothing to buy">
          Everything in the pantry is marked as in stock. Open a recipe and hit Check
          pantry and anything missing lands here.
        </EmptyState>
      ) : (
        AISLES.map((group) => {
          const groupItems = list.filter((item) => item.aisle === group.value)
          if (groupItems.length === 0) return null

          return (
            <div className="category-group-block" key={group.value}>
              <h3>{group.label}</h3>
              <ul className="list">
                {groupItems.map((item) => (
                  <li key={item.id} className="list-row task-row">
                    <div className="task-row-body">
                      <button
                        type="button"
                        className="task-check"
                        onClick={() => gotIt(item)}
                        aria-label="Got it"
                      />
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">
                          {item.name}
                          {item.staple && <span className="priority-pill">staple</span>}
                        </span>
                        <span className="list-row-sub task-meta">
                          <span className={statusTone(item.status)}>
                            {STATUSES.find((s) => s.value === item.status)?.label}
                          </span>
                          {item.unit && <span>{item.unit}</span>}
                          {item.needed_note && <span>for {item.needed_note}</span>}
                        </span>
                      </div>
                      {item.est_cost && <span className="money">{formatMoney(item.est_cost)}</span>}
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() =>
                          updateItem(item.id, {
                            status: item.status === 'out' ? 'low' : 'out',
                          })
                        }
                        title="Toggle between out and running low"
                      >
                        {item.status === 'out' ? 'Low' : 'Out'}
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
