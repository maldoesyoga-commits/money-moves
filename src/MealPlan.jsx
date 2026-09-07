import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'
import { periodRange, shiftPeriod, periodLabel, isCurrentPeriod, daysInRange } from './lib/planPeriods'

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

function MealPlan() {
  const [anchor, setAnchor] = useState(todayISO())
  const [plan, setPlan] = useState([])
  const [meals, setMeals] = useState([])
  const [drafts, setDrafts] = useState({})
  const [mealType, setMealType] = useState('dinner')

  const { start, end } = useMemo(() => periodRange('week', anchor), [anchor])
  const days = useMemo(() => daysInRange(start, end), [start, end])

  const loadPlan = useCallback(async () => {
    const { data, error } = await supabase
      .from('meal_plan')
      .select('*')
      .gte('plan_date', start)
      .lte('plan_date', end)
      .order('plan_date')

    if (error) {
      console.log('Failed to load meal plan', error.message)
      return
    }

    setPlan(data)
  }, [start, end])

  const loadMeals = useCallback(async () => {
    const { data, error } = await supabase.from('meals').select('*').order('name')

    if (error) {
      console.log('Failed to load meals', error.message)
      return
    }

    setMeals(data)
  }, [])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  useEffect(() => {
    loadMeals()
  }, [loadMeals])

  async function addPlanned(date, value) {
    if (!value) return

    const payload = { plan_date: date, meal_type: mealType }
    if (value.startsWith('meal:')) payload.meal_id = value.slice(5)
    else payload.custom_title = value

    const { error } = await supabase.from('meal_plan').insert(payload)

    if (error) {
      console.log('Failed to plan meal', error.message)
      return
    }

    setDrafts((prev) => ({ ...prev, [date]: '' }))
    loadPlan()
  }

  async function removePlanned(id) {
    setPlan((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('meal_plan').delete().eq('id', id)

    if (error) {
      console.log('Failed to remove planned meal', error.message)
      loadPlan()
    }
  }

  async function markMade(row) {
    if (!row.meal_id) return

    const { error } = await supabase
      .from('meals')
      .update({ last_made_at: row.plan_date })
      .eq('id', row.meal_id)

    if (error) {
      console.log('Failed to mark meal as made', error.message)
      return
    }

    loadMeals()
  }

  async function addIngredientsToList(row) {
    const meal = meals.find((item) => item.id === row.meal_id)
    if (!meal?.ingredients) return

    const lines = meal.ingredients
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) return

    const { error } = await supabase
      .from('grocery_items')
      .insert(lines.map((name) => ({ name, meal_id: meal.id })))

    if (error) console.log('Failed to add ingredients', error.message)
  }

  function titleFor(row) {
    if (row.custom_title) return row.custom_title
    return meals.find((meal) => meal.id === row.meal_id)?.name || 'Meal'
  }

  return (
    <div className="card">
      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod('week', anchor, -1))}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{periodLabel('week', anchor)}</span>
          {!isCurrentPeriod('week', anchor) && (
            <button type="button" className="period-today-link" onClick={() => setAnchor(todayISO())}>
              This week
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod('week', anchor, 1))}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <nav className="view-tabs">
        {MEAL_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`view-tab${mealType === value ? ' active' : ''}`}
            onClick={() => setMealType(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="week-grid">
        {days.map((day) => {
          const dayRows = plan.filter((row) => row.plan_date === day)
          const label = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
          const isToday = day === todayISO()

          return (
            <div key={day} className={`day-block${isToday ? ' day-today' : ''}`}>
              <h4>{label}</h4>

              {dayRows.length === 0 ? (
                <p className="empty-text">Nothing planned.</p>
              ) : (
                <ul className="list">
                  {dayRows.map((row) => (
                    <li key={row.id} className="list-row">
                      <div className="list-row-main">
                        <span className="list-row-title">{titleFor(row)}</span>
                        <span className="list-row-sub">{row.meal_type}</span>
                      </div>
                      <div className="stage-nudge">
                        {row.meal_id && (
                          <>
                            <button
                              type="button"
                              className="row-action-btn"
                              onClick={() => addIngredientsToList(row)}
                            >
                              To list
                            </button>
                            <button
                              type="button"
                              className="row-action-btn"
                              onClick={() => markMade(row)}
                            >
                              Made it
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => removePlanned(row.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mini-form">
                <select
                  className="inline-select"
                  value={drafts[day] || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    setDrafts((prev) => ({ ...prev, [day]: value }))
                    if (value) addPlanned(day, value)
                  }}
                >
                  <option value="">Add a meal…</option>
                  {meals.map((meal) => (
                    <option key={meal.id} value={`meal:${meal.id}`}>
                      {meal.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MealPlan
