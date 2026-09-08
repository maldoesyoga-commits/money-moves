import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatDueDate } from './lib/taskDates'
import { report } from './lib/report'
import {
  AISLES,
  STATUSES,
  statusTone,
  ensurePantryItem,
  checkMealAgainstPantry,
} from './lib/pantry'

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

const EFFORTS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'project', label: 'Project' },
]

const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'favourite', label: 'Favourites' },
  { key: 'easy', label: 'Easy wins' },
]

function Recipes() {
  const [meals, setMeals] = useState([])
  const [pantry, setPantry] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [drafts, setDrafts] = useState({})
  const [checkResult, setCheckResult] = useState({})
  const [view, setView] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('dinner')
  const [effort, setEffort] = useState('medium')

  const loadMeals = useCallback(async () => {
    const { data, error } = await supabase.from('meals').select('*').order('name')

    if (error) {
      report('Failed to load meals', error)
      return
    }

    setMeals(data)
  }, [])

  const loadPantry = useCallback(async () => {
    const [{ data: pantryRows, error }, { data: ingredientRows }] = await Promise.all([
      supabase.from('pantry_items').select('*').order('name'),
      supabase.from('meal_ingredients').select('*').order('sort_order'),
    ])

    if (error) {
      report('Failed to load the pantry', error)
      return
    }

    setPantry(pantryRows || [])
    setIngredients(ingredientRows || [])
  }, [])

  useEffect(() => {
    loadMeals()
    loadPantry()
  }, [loadMeals, loadPantry])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('meals')
      .insert({ name: trimmed, meal_type: mealType, effort })

    if (error) {
      report('Failed to add meal', error)
      return
    }

    setName('')
    loadMeals()
  }

  async function updateMeal(id, patch) {
    setMeals((prev) => prev.map((meal) => (meal.id === id ? { ...meal, ...patch } : meal)))

    const { error } = await supabase.from('meals').update(patch).eq('id', id)

    if (error) {
      report('Failed to update meal', error)
      loadMeals()
    }
  }

  async function deleteMeal(id) {
    setMeals((prev) => prev.filter((meal) => meal.id !== id))

    const { error } = await supabase.from('meals').delete().eq('id', id)

    if (error) {
      report('Failed to delete meal', error)
      loadMeals()
    }
  }

  const pantryById = Object.fromEntries(pantry.map((item) => [item.id, item]))

  // Typing an ingredient creates the pantry row if it's new, then links it.
  // The ingredient and the shopping-list entry are the same record.
  async function addIngredient(e, meal) {
    e.preventDefault()

    const draft = drafts[meal.id] || {}
    const trimmed = (draft.name || '').trim()
    if (!trimmed) return

    const { item, error } = await ensurePantryItem(trimmed, {
      aisle: draft.aisle || 'other',
      status: 'out',
    })

    if (error) {
      report('Failed to add ingredient', error)
      return
    }

    const { error: linkError } = await supabase.from('meal_ingredients').insert({
      meal_id: meal.id,
      pantry_item_id: item.id,
      amount: draft.amount || null,
      sort_order: ingredients.filter((row) => row.meal_id === meal.id).length,
    })

    if (linkError && linkError.code !== '23505') {
      report('Failed to link ingredient', linkError)
      return
    }

    setDrafts((prev) => ({ ...prev, [meal.id]: {} }))
    loadPantry()
  }

  async function removeIngredient(id) {
    setIngredients((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('meal_ingredients').delete().eq('id', id)

    if (error) {
      report('Failed to remove ingredient', error)
      loadPantry()
    }
  }

  // One-time move for meals whose ingredients are still a blob of text.
  async function importIngredientText(meal) {
    if (!meal.ingredients) return

    const lines = meal.ingredients
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) return

    for (const line of lines) {
      const { item, error } = await ensurePantryItem(line, { status: 'out' })
      if (error || !item) continue

      await supabase
        .from('meal_ingredients')
        .insert({ meal_id: meal.id, pantry_item_id: item.id })
    }

    loadPantry()
  }

  // Compare what this meal needs against what's in the pantry.
  async function checkPantry(meal) {
    const mine = ingredients.filter((row) => row.meal_id === meal.id)

    if (mine.length === 0) {
      setCheckResult((prev) => ({
        ...prev,
        [meal.id]: 'No ingredients linked yet — add them below first.',
      }))
      return
    }

    const { missing, error } = await checkMealAgainstPantry(meal, mine, pantryById)

    if (error) {
      report('Failed to check the pantry', error)
      return
    }

    setCheckResult((prev) => ({
      ...prev,
      [meal.id]:
        missing.length === 0
          ? `Everything for ${meal.name} is in the pantry — nothing to buy.`
          : `Need ${missing.length} of ${mine.length}: ${missing
              .map((item) => item.name)
              .join(', ')}. Added to the shopping list.`,
    }))

    loadPantry()
  }

  function draftFor(id, key, fallback) {
    return drafts[id]?.[key] ?? fallback
  }

  function setDraft(id, key, value) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  const visible = meals.filter((meal) => {
    if (view === 'favourite') return meal.favourite
    if (view === 'easy') return meal.effort === 'easy'
    return true
  })

  return (
    <div className="card">
      <h2>Meals</h2>

      <form className="quick-add" onSubmit={handleAdd}>
        <input
          type="text"
          className="quick-add-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Meal name"
        />
        <div className="field-row">
          <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {MEAL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={effort} onChange={(e) => setEffort(e.target.value)}>
            {EFFORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit">Add meal</button>
        </div>
      </form>

      <datalist id="pantry-names">
        {pantry.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>

      <nav className="view-tabs">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`view-tab${view === key ? ' active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState icon="🍳" title="No meals saved yet">
          Save the things you actually cook. Paste the ingredients in and you can send
          them straight to the grocery list later with one tap.
        </EmptyState>
      ) : (
        <ul className="list">
          {visible.map((meal) => {
            const open = expandedId === meal.id

            return (
              <li key={meal.id} className="list-row project-row">
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`star-button${meal.favourite ? ' on' : ''}`}
                    onClick={() => updateMeal(meal.id, { favourite: !meal.favourite })}
                    aria-label={meal.favourite ? 'Remove favourite' : 'Mark favourite'}
                  >
                    {meal.favourite ? '★' : '☆'}
                  </button>
                  <div className="list-row-main task-main">
                    <span className="list-row-title">
                      {meal.url ? (
                        <a href={meal.url} target="_blank" rel="noreferrer" className="project-link">
                          {meal.name}
                        </a>
                      ) : (
                        meal.name
                      )}
                    </span>
                    <span className="list-row-sub task-meta">
                      <span>{meal.meal_type}</span>
                      <span className="priority-pill">{meal.effort}</span>
                      {meal.last_made_at && <span>made {formatDueDate(meal.last_made_at)}</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setExpandedId(open ? null : meal.id)}
                  >
                    {open ? 'Close' : 'Open'}
                  </button>
                </div>

                {open && (
                  <div className="learning-detail">
                    <div className="task-controls">
                      <select
                        className="inline-select"
                        value={meal.meal_type}
                        onChange={(e) => updateMeal(meal.id, { meal_type: e.target.value })}
                      >
                        {MEAL_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="inline-select"
                        value={meal.effort}
                        onChange={(e) => updateMeal(meal.id, { effort: e.target.value })}
                      >
                        {EFFORTS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => checkPantry(meal)}
                      >
                        Check pantry
                      </button>
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteMeal(meal.id)}
                      >
                        Delete
                      </button>
                    </div>

                    {checkResult[meal.id] && (
                      <p className="budget-gentle-note">{checkResult[meal.id]}</p>
                    )}

                    <h3>Ingredients</h3>
                    {ingredients.filter((row) => row.meal_id === meal.id).length === 0 ? (
                      <p className="empty-text">
                        None linked yet.
                        {meal.ingredients ? ' There is still text in the box below — ' : ' '}
                        {meal.ingredients && (
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => importIngredientText(meal)}
                          >
                            turn it into pantry items
                          </button>
                        )}
                      </p>
                    ) : (
                      <ul className="list">
                        {ingredients
                          .filter((row) => row.meal_id === meal.id)
                          .map((row) => {
                            const item = pantryById[row.pantry_item_id]
                            if (!item) return null

                            return (
                              <li key={row.id} className="list-row">
                                <div className="task-row-body">
                                  <div className="list-row-main task-main">
                                    <span className="list-row-title task-title">
                                      {item.name}
                                      {row.amount && (
                                        <span className="priority-pill">{row.amount}</span>
                                      )}
                                    </span>
                                    <span className="list-row-sub task-meta">
                                      <span className={statusTone(item.status)}>
                                        {STATUSES.find((s) => s.value === item.status)?.label}
                                      </span>
                                      <span>{item.aisle}</span>
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    className="row-action-btn row-action-btn-danger"
                                    onClick={() => removeIngredient(row.id)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                      </ul>
                    )}

                    <form className="field-row" onSubmit={(e) => addIngredient(e, meal)}>
                      <input
                        type="text"
                        value={draftFor(meal.id, 'name', '')}
                        onChange={(e) => setDraft(meal.id, 'name', e.target.value)}
                        placeholder="ingredient"
                        list="pantry-names"
                      />
                      <input
                        type="text"
                        className="target-input"
                        value={draftFor(meal.id, 'amount', '')}
                        onChange={(e) => setDraft(meal.id, 'amount', e.target.value)}
                        placeholder="amount"
                      />
                      <select
                        className="inline-select"
                        value={draftFor(meal.id, 'aisle', 'other')}
                        onChange={(e) => setDraft(meal.id, 'aisle', e.target.value)}
                      >
                        {AISLES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-secondary">
                        Add
                      </button>
                    </form>

                    <input
                      type="url"
                      value={meal.url || ''}
                      placeholder="recipe link"
                      onChange={(e) => updateMeal(meal.id, { url: e.target.value || null })}
                    />
                    <textarea
                      rows="3"
                      value={meal.ingredients || ''}
                      placeholder="ingredients, one per line or comma separated"
                      onChange={(e) => updateMeal(meal.id, { ingredients: e.target.value || null })}
                    />
                    <textarea
                      rows="2"
                      value={meal.notes || ''}
                      placeholder="notes — swaps, timings, what worked"
                      onChange={(e) => updateMeal(meal.id, { notes: e.target.value || null })}
                    />
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

export default Recipes
