import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { formatDueDate } from './lib/taskDates'

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
  const [view, setView] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const [name, setName] = useState('')
  const [mealType, setMealType] = useState('dinner')
  const [effort, setEffort] = useState('medium')

  const loadMeals = useCallback(async () => {
    const { data, error } = await supabase.from('meals').select('*').order('name')

    if (error) {
      console.log('Failed to load meals', error.message)
      return
    }

    setMeals(data)
  }, [])

  useEffect(() => {
    loadMeals()
  }, [loadMeals])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('meals')
      .insert({ name: trimmed, meal_type: mealType, effort })

    if (error) {
      console.log('Failed to add meal', error.message)
      return
    }

    setName('')
    loadMeals()
  }

  async function updateMeal(id, patch) {
    setMeals((prev) => prev.map((meal) => (meal.id === id ? { ...meal, ...patch } : meal)))

    const { error } = await supabase.from('meals').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update meal', error.message)
      loadMeals()
    }
  }

  async function deleteMeal(id) {
    setMeals((prev) => prev.filter((meal) => meal.id !== id))

    const { error } = await supabase.from('meals').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete meal', error.message)
      loadMeals()
    }
  }

  async function addIngredients(meal) {
    if (!meal.ingredients) return

    const lines = meal.ingredients
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) return

    const { error } = await supabase
      .from('grocery_items')
      .insert(lines.map((item) => ({ name: item, meal_id: meal.id })))

    if (error) console.log('Failed to add ingredients', error.message)
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
                        onClick={() => addIngredients(meal)}
                      >
                        Ingredients to list
                      </button>
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteMeal(meal.id)}
                      >
                        Delete
                      </button>
                    </div>

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
