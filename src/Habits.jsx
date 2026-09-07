import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'
import { streakFrom, shiftDate } from './lib/daily'
import EmptyState from './EmptyState'

const SLOTS = [
  { value: 'any', label: 'Any time' },
  { value: 'am', label: 'Morning' },
  { value: 'pm', label: 'Evening' },
]

const STARTERS = [
  { name: 'Skincare', icon: '🧴', slot: 'am' },
  { name: 'Skincare', icon: '🧴', slot: 'pm' },
  { name: 'Oral hygiene', icon: '🪥', slot: 'am' },
  { name: 'Oral hygiene', icon: '🪥', slot: 'pm' },
  { name: 'Movement', icon: '🚶', slot: 'any' },
]

function Habits() {
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [showArchived, setShowArchived] = useState(false)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [slot, setSlot] = useState('any')

  const loadHabits = useCallback(async () => {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load habits', error.message)
      return
    }

    setHabits(data)
  }, [])

  const loadLogs = useCallback(async () => {
    // Last 60 days is enough for a streak and a month view.
    const from = shiftDate(todayISO(), -60)

    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date')
      .gte('log_date', from)

    if (error) {
      console.log('Failed to load habit logs', error.message)
      return
    }

    setLogs(data)
  }, [])

  useEffect(() => {
    loadHabits()
    loadLogs()
  }, [loadHabits, loadLogs])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed, slot, sort_order: habits.length }
    if (icon.trim()) payload.icon = icon.trim()

    const { error } = await supabase.from('habits').insert(payload)

    if (error) {
      console.log('Failed to add habit', error.message)
      return
    }

    setName('')
    setIcon('')
    setSlot('any')
    loadHabits()
  }

  async function addStarters() {
    const { error } = await supabase
      .from('habits')
      .insert(STARTERS.map((habit, index) => ({ ...habit, sort_order: index })))

    if (error) {
      console.log('Failed to add starter habits', error.message)
      return
    }

    loadHabits()
  }

  async function updateHabit(id, patch) {
    setHabits((prev) => prev.map((habit) => (habit.id === id ? { ...habit, ...patch } : habit)))

    const { error } = await supabase.from('habits').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update habit', error.message)
      loadHabits()
    }
  }

  async function deleteHabit(id) {
    setHabits((prev) => prev.filter((habit) => habit.id !== id))

    const { error } = await supabase.from('habits').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete habit', error.message)
      loadHabits()
    }
  }

  const visible = habits.filter((habit) => showArchived || habit.active)
  const last14 = Array.from({ length: 14 }, (_, i) => shiftDate(todayISO(), -13 + i))

  return (
    <div className="card">
      <h2>Habits</h2>

      <form onSubmit={handleAdd}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="habit name"
          />
          <input
            type="text"
            className="target-input"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="emoji"
            maxLength="2"
          />
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>
            {SLOTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit">Add habit</button>
        </div>
      </form>

      {habits.length > 0 && (
        <div className="transaction-filter-bar">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <>
          <EmptyState icon="🔁" title="No habits yet">
            Add the things you want to do most days. They appear as a checklist on the
            Today tab, and the dots below fill in as you tick them off.
          </EmptyState>
          {habits.length === 0 && (
            <div className="water-actions">
              <button type="button" className="btn-secondary" onClick={addStarters}>
                Start with skincare, oral hygiene and movement
              </button>
            </div>
          )}
        </>
      ) : (
        <ul className="list">
          {visible.map((habit) => {
            const dates = logs.filter((row) => row.habit_id === habit.id).map((row) => row.log_date)
            const streak = streakFrom(dates, todayISO())
            const set = new Set(dates)
            const hit = last14.filter((day) => set.has(day)).length

            return (
              <li key={habit.id} className={`list-row project-row${habit.active ? '' : ' task-done'}`}>
                <div className="task-row-body">
                  <div className="list-row-main task-main">
                    <span className="list-row-title task-title">
                      {habit.icon ? `${habit.icon} ` : ''}
                      {habit.name}
                      {habit.slot !== 'any' && (
                        <span className="priority-pill habit-slot">{habit.slot.toUpperCase()}</span>
                      )}
                    </span>
                    <span className="list-row-sub">
                      {streak > 0 ? `${streak} day streak · ` : ''}
                      {hit} of the last 14
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => updateHabit(habit.id, { active: !habit.active })}
                  >
                    {habit.active ? 'Archive' : 'Restore'}
                  </button>
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => deleteHabit(habit.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="habit-dots">
                  {last14.map((day) => (
                    <span
                      key={day}
                      className={`habit-dot${set.has(day) ? ' on' : ''}`}
                      title={day}
                    />
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Habits
