import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO, formatDueDate } from './lib/taskDates'
import { DEFAULT_MOOD_WORDS, sleepHours, formatSleep, shiftDate } from './lib/daily'

function DailyToday() {
  const [date, setDate] = useState(todayISO())
  const [log, setLog] = useState(null)
  const [habits, setHabits] = useState([])
  const [doneToday, setDoneToday] = useState([])
  const [savedAt, setSavedAt] = useState(null)
  const [moodWords, setMoodWords] = useState([])
  const [editingMoods, setEditingMoods] = useState(false)
  const [newMood, setNewMood] = useState('')

  const timers = useRef({})

  const loadLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('entry_date', date)
      .maybeSingle()

    if (error) {
      console.log('Failed to load daily log', error.message)
      return
    }

    setLog(data || { entry_date: date, mood_words: [], water_glasses: 0, water_goal: 8 })
  }, [date])

  // Your mood words live in the database. First run seeds the starter list.
  const loadMoodWords = useCallback(async () => {
    const { data, error } = await supabase
      .from('mood_words')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('word')

    if (error) {
      console.log('Mood words unavailable, using defaults', error.message)
      setMoodWords(DEFAULT_MOOD_WORDS.map((word) => ({ id: word, word })))
      return
    }

    if (data.length === 0) {
      const { error: seedError } = await supabase
        .from('mood_words')
        .insert(DEFAULT_MOOD_WORDS.map((word, index) => ({ word, sort_order: index })))

      if (seedError) {
        console.log('Failed to seed mood words', seedError.message)
        setMoodWords(DEFAULT_MOOD_WORDS.map((word) => ({ id: word, word })))
        return
      }

      const { data: seeded } = await supabase
        .from('mood_words')
        .select('*')
        .eq('active', true)
        .order('sort_order')

      setMoodWords(seeded || [])
      return
    }

    setMoodWords(data)
  }, [])

  async function addMoodWord(e) {
    e.preventDefault()

    const word = newMood.trim().toLowerCase()
    if (!word) return

    if (moodWords.some((row) => row.word === word)) {
      setNewMood('')
      return
    }

    const { error } = await supabase
      .from('mood_words')
      .insert({ word, sort_order: moodWords.length })

    if (error) {
      console.log('Failed to add mood word', error.message)
      return
    }

    setNewMood('')
    loadMoodWords()
  }

  // Archived rather than deleted, so past days keep the word they recorded.
  async function retireMoodWord(row) {
    setMoodWords((prev) => prev.filter((item) => item.id !== row.id))

    const { error } = await supabase.from('mood_words').update({ active: false }).eq('id', row.id)

    if (error) {
      console.log('Failed to remove mood word', error.message)
      loadMoodWords()
    }
  }

  const loadHabits = useCallback(async () => {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load habits', error.message)
      return
    }

    setHabits(data)
  }, [])

  const loadHabitLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('log_date', date)

    if (error) {
      console.log('Failed to load habit logs', error.message)
      return
    }

    setDoneToday(data)
  }, [date])

  useEffect(() => {
    loadLog()
    loadHabitLogs()
  }, [loadLog, loadHabitLogs])

  useEffect(() => {
    loadHabits()
    loadMoodWords()
  }, [loadHabits, loadMoodWords])

  // Upsert on the (user, date) pair so a day always has exactly one row.
  const save = useCallback(
    async (patch) => {
      const next = { ...log, ...patch }
      setLog(next)

      const payload = {
        entry_date: date,
        wake_time: next.wake_time || null,
        bedtime: next.bedtime || null,
        sleep_score: next.sleep_score ?? null,
        happiness: next.happiness ?? null,
        energy: next.energy ?? null,
        mood_words: next.mood_words || [],
        water_glasses: next.water_glasses ?? 0,
        water_goal: next.water_goal ?? 8,
        morning_gratitude: next.morning_gratitude || null,
        evening_gratitude: next.evening_gratitude || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('daily_logs')
        .upsert(payload, { onConflict: 'user_id,entry_date' })

      if (error) {
        console.log('Failed to save daily log', error.message)
        return
      }

      setSavedAt(new Date())
    },
    [log, date],
  )

  function saveSoon(key, value) {
    setLog((prev) => ({ ...prev, [key]: value }))

    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => save({ [key]: value }), 700)
  }

  function toggleWord(word) {
    const words = log.mood_words || []
    const next = words.includes(word) ? words.filter((w) => w !== word) : [...words, word]
    save({ mood_words: next })
  }

  async function toggleHabit(habit) {
    const existing = doneToday.find((row) => row.habit_id === habit.id)

    if (existing) {
      setDoneToday((prev) => prev.filter((row) => row.id !== existing.id))
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id)
      if (error) {
        console.log('Failed to untick habit', error.message)
        loadHabitLogs()
      }
      return
    }

    const { error } = await supabase
      .from('habit_logs')
      .insert({ habit_id: habit.id, log_date: date })

    if (error) {
      console.log('Failed to tick habit', error.message)
      return
    }

    loadHabitLogs()
  }

  if (!log) return <p className="empty-text">Loading…</p>

  const hours = sleepHours(log.bedtime, log.wake_time)
  const glasses = log.water_glasses || 0
  const goal = log.water_goal || 8
  const waterPct = Math.min(100, Math.round((glasses / goal) * 100))
  const habitsDone = habits.filter((habit) => doneToday.some((row) => row.habit_id === habit.id))

  return (
    <>
      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setDate(shiftDate(date, -1))}
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{date === todayISO() ? 'Today' : formatDueDate(date)}</span>
          {date !== todayISO() && (
            <button type="button" className="period-today-link" onClick={() => setDate(todayISO())}>
              Back to today
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= todayISO()}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      <div className="card">
        <h2>Sleep</h2>
        <div className="field-row">
          <label>
            Bedtime
            <input
              type="time"
              value={log.bedtime || ''}
              onChange={(e) => save({ bedtime: e.target.value })}
            />
          </label>
          <label>
            Wake
            <input
              type="time"
              value={log.wake_time || ''}
              onChange={(e) => save({ wake_time: e.target.value })}
            />
          </label>
          <label>
            Score
            <input
              type="number"
              min="0"
              max="100"
              value={log.sleep_score ?? ''}
              onChange={(e) =>
                saveSoon('sleep_score', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </label>
        </div>
        {hours !== null && (
          <p className="daily-readout">
            {formatSleep(hours)}
            <span className="list-row-sub">
              {hours < 6 ? ' — short one' : hours > 9 ? ' — long one' : ''}
            </span>
          </p>
        )}
      </div>

      <div className="card">
        <h2>How it felt</h2>

        <div className="scale-row">
          <label>Happiness</label>
          <div className="scale-buttons">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                className={`scale-dot${log.happiness === n ? ' on' : ''}`}
                onClick={() => save({ happiness: log.happiness === n ? null : n })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="scale-row">
          <label>Energy</label>
          <div className="scale-buttons">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                className={`scale-dot${log.energy === n ? ' on' : ''}`}
                onClick={() => save({ energy: log.energy === n ? null : n })}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="project-scope-header mood-header">
          <h3>Three words</h3>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setEditingMoods((open) => !open)}
          >
            {editingMoods ? 'Done' : 'Edit list'}
          </button>
        </div>

        <div className="tag-cloud">
          {moodWords.map((row) => {
            const on = (log.mood_words || []).includes(row.word)

            return (
              <span key={row.id} className="mood-chip-wrap">
                <button
                  type="button"
                  className={`tag-chip${on ? ' attached' : ''}`}
                  onClick={() => toggleWord(row.word)}
                >
                  {row.word}
                </button>
                {editingMoods && row.id !== row.word && (
                  <button
                    type="button"
                    className="mood-remove"
                    onClick={() => retireMoodWord(row)}
                    aria-label={`Remove ${row.word}`}
                    title="Remove from the list"
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
        </div>

        <form className="mini-form mood-add" onSubmit={addMoodWord}>
          <input
            type="text"
            value={newMood}
            onChange={(e) => setNewMood(e.target.value)}
            placeholder="add your own word"
            maxLength="40"
          />
          <button type="submit" className="btn-secondary">
            Add
          </button>
        </form>

        {(log.mood_words || []).some((word) => !moodWords.some((row) => row.word === word)) && (
          <p className="list-row-sub retired-note">
            Also today:{' '}
            {(log.mood_words || [])
              .filter((word) => !moodWords.some((row) => row.word === word))
              .join(', ')}
          </p>
        )}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Water</h2>
          <span className="money">
            {glasses} / {goal}
          </span>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${waterPct}%` }} />
        </div>

        <div className="water-actions">
          <button type="button" onClick={() => save({ water_glasses: glasses + 1 })}>
            + a glass
          </button>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => save({ water_glasses: Math.max(0, glasses - 1) })}
          >
            −
          </button>
          <label className="filter-toggle">
            goal
            <input
              type="number"
              min="1"
              className="target-input"
              value={goal}
              onChange={(e) => saveSoon('water_goal', Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Habits</h2>
          <span className="list-row-sub">
            {habitsDone.length} of {habits.length}
          </span>
        </div>

        {habits.length === 0 ? (
          <p className="empty-text">
            No habits set up yet — add them on the Habits tab and they show up here every day.
          </p>
        ) : (
          <ul className="list">
            {habits.map((habit) => {
              const done = doneToday.some((row) => row.habit_id === habit.id)

              return (
                <li key={habit.id} className={`list-row task-row${done ? ' task-done' : ''}`}>
                  <div className="task-row-body">
                    <button
                      type="button"
                      className={`task-check${done ? ' checked' : ''}`}
                      onClick={() => toggleHabit(habit)}
                      aria-label={done ? 'Undo' : 'Mark done'}
                    >
                      {done ? '✓' : ''}
                    </button>
                    <div className="list-row-main task-main">
                      <span className="list-row-title task-title">
                        {habit.icon ? `${habit.icon} ` : ''}
                        {habit.name}
                      </span>
                    </div>
                    {habit.slot !== 'any' && (
                      <span className="priority-pill">{habit.slot.toUpperCase()}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Gratitude</h2>
        <label>
          Morning
          <input
            type="text"
            value={log.morning_gratitude || ''}
            onChange={(e) => saveSoon('morning_gratitude', e.target.value)}
            placeholder="what you woke up glad about"
          />
        </label>
        <label>
          End of day
          <input
            type="text"
            value={log.evening_gratitude || ''}
            onChange={(e) => saveSoon('evening_gratitude', e.target.value)}
            placeholder="one good thing from today"
          />
        </label>
        <p className="list-row-sub">
          {savedAt
            ? `Saved ${savedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : 'Saves as you go.'}
        </p>
      </div>
    </>
  )
}

export default DailyToday
