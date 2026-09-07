import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO, formatDueDate } from './lib/taskDates'
import EmptyState from './EmptyState'
import { report } from './lib/report'

const MOODS = [
  { value: 'rough', label: 'Rough' },
  { value: 'low', label: 'Low' },
  { value: 'steady', label: 'Steady' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
]

function Journal() {
  const [entries, setEntries] = useState([])
  const [date, setDate] = useState(todayISO())
  const [body, setBody] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [mood, setMood] = useState('')
  const [entryId, setEntryId] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [openId, setOpenId] = useState(null)

  const timer = useRef(null)
  const loadedFor = useRef(null)

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })

    if (error) {
      report('Failed to load journal', error)
      return
    }

    setEntries(data)
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Switching date loads that day's entry into the writing box.
  useEffect(() => {
    if (loadedFor.current === date) return

    const existing = entries.find((entry) => entry.entry_date === date)
    loadedFor.current = date
    setEntryId(existing?.id || null)
    setBody(existing?.body || '')
    setGratitude(existing?.gratitude || '')
    setMood(existing?.mood || '')
    setSavedAt(null)
  }, [date, entries])

  const save = useCallback(
    async (patch) => {
      const payload = { entry_date: date, body, gratitude: gratitude || null, mood: mood || null, ...patch }

      if (!payload.body.trim() && !payload.gratitude && !payload.mood) return

      if (entryId) {
        const { error } = await supabase
          .from('journal_entries')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', entryId)

        if (error) {
          report('Failed to save journal entry', error)
          return
        }
      } else {
        const { data, error } = await supabase
          .from('journal_entries')
          .insert(payload)
          .select()
          .single()

        if (error) {
          report('Failed to create journal entry', error)
          return
        }

        setEntryId(data.id)
      }

      setSavedAt(new Date())
      loadEntries()
    },
    [date, body, gratitude, mood, entryId, loadEntries],
  )

  function handleBody(value) {
    setBody(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save({ body: value }), 800)
  }

  async function deleteEntry(id) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))

    const { error } = await supabase.from('journal_entries').delete().eq('id', id)

    if (error) {
      report('Failed to delete entry', error)
      loadEntries()
      return
    }

    if (id === entryId) {
      setEntryId(null)
      setBody('')
      setGratitude('')
      setMood('')
    }
  }

  const past = entries.filter((entry) => entry.entry_date !== date)
  const streak = (() => {
    const dates = new Set(entries.map((entry) => entry.entry_date))
    let count = 0
    const cursor = new Date(`${todayISO()}T12:00:00`)

    while (dates.has(cursor.toISOString().slice(0, 10)) && count < 999) {
      count += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    return count
  })()

  return (
    <>
      <div className="card">
        <div className="project-scope-header">
          <h2>{date === todayISO() ? 'Today' : formatDueDate(date)}</h2>
          <input
            type="date"
            className="inline-select"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {streak > 1 && (
          <p className="list-row-sub">
            {streak} days in a row.
          </p>
        )}

        <textarea
          className="journal-box"
          rows="10"
          value={body}
          onChange={(e) => handleBody(e.target.value)}
          placeholder="How did today go?"
        />

        <div className="field-row journal-extras">
          <input
            type="text"
            value={gratitude}
            onChange={(e) => setGratitude(e.target.value)}
            onBlur={() => save({ gratitude: gratitude || null })}
            placeholder="one good thing"
          />
          <select
            value={mood}
            onChange={(e) => {
              setMood(e.target.value)
              save({ mood: e.target.value || null })
            }}
          >
            <option value="">Mood</option>
            {MOODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <p className="list-row-sub">
          {savedAt
            ? `Saved ${savedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : 'Saves as you write.'}
        </p>
      </div>

      <div className="card">
        <h2>Earlier</h2>

        {past.length === 0 ? (
          <EmptyState icon="📔" title="Nothing written yet">
            Private to you — same row-level security as everything else here. Write a
            line or a page, whatever the day was.
          </EmptyState>
        ) : (
          <ul className="list">
            {past.map((entry) => {
              const open = openId === entry.id

              return (
                <li key={entry.id} className="list-row project-row">
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title">{formatDueDate(entry.entry_date)}</span>
                      <span className="list-row-sub task-meta">
                        {entry.mood && <span className="priority-pill">{entry.mood}</span>}
                        <span>{(entry.body || '').slice(0, 80)}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setOpenId(open ? null : entry.id)}
                    >
                      {open ? 'Close' : 'Read'}
                    </button>
                  </div>

                  {open && (
                    <div className="learning-detail">
                      <p className="journal-read">{entry.body}</p>
                      {entry.gratitude && (
                        <p className="list-row-sub">Good thing: {entry.gratitude}</p>
                      )}
                      <div className="task-controls">
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => setDate(entry.entry_date)}
                        >
                          Edit this day
                        </button>
                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => deleteEntry(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
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

export default Journal
