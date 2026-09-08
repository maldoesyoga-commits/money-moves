import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO } from './lib/taskDates'
import { shiftDate } from './lib/daily'

function longDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// A quiet room. No prompts unless you go looking for them.
function Journal() {
  const [date, setDate] = useState(todayISO())
  const [entry, setEntry] = useState(null)
  const [body, setBody] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [entries, setEntries] = useState([])
  const [showShelf, setShowShelf] = useState(false)
  const [openId, setOpenId] = useState(null)

  const timer = useRef(null)

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })

    if (error) {
      report('Failed to load the journal', error)
      return
    }

    setEntries(data)
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Load whichever day is on the desk.
  useEffect(() => {
    const found = entries.find((row) => row.entry_date === date) || null
    setEntry(found)
    setBody(found?.body || '')
    setSavedAt(null)
  }, [date, entries])

  const save = useCallback(
    async (value) => {
      const text = value ?? body

      if (!text.trim() && !entry) return

      if (entry) {
        const { error } = await supabase
          .from('journal_entries')
          .update({ body: text, updated_at: new Date().toISOString() })
          .eq('id', entry.id)

        if (error) {
          report('Failed to save the entry', error)
          return
        }

        setSavedAt(new Date())
        return
      }

      const { data, error } = await supabase
        .from('journal_entries')
        .insert({ entry_date: date, body: text })
        .select()
        .single()

      if (error) {
        report('Failed to save the entry', error)
        return
      }

      setEntry(data)
      setSavedAt(new Date())
      loadEntries()
    },
    [body, date, entry, loadEntries],
  )

  function handleBody(value) {
    setBody(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(value), 900)
  }

  async function deleteEntry(id) {
    setEntries((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('journal_entries').delete().eq('id', id)

    if (error) {
      report('Failed to delete the entry', error)
      loadEntries()
      return
    }

    if (entry?.id === id) {
      setEntry(null)
      setBody('')
    }
  }

  const written = new Set(entries.map((row) => row.entry_date))
  const streak = (() => {
    let cursor = todayISO()
    let count = 0
    if (!written.has(cursor)) cursor = shiftDate(cursor, -1)
    while (written.has(cursor) && count < 999) {
      count += 1
      cursor = shiftDate(cursor, -1)
    }
    return count
  })()

  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const past = entries.filter((row) => row.entry_date !== date)

  return (
    <div className="journal">
      <div className="journal-paper">
        <div className="journal-head">
          <button
            type="button"
            className="journal-arrow"
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="The day before"
          >
            ‹
          </button>

          <div className="journal-date">
            <span className="journal-dear">Dear diary,</span>
            <span className="journal-day">{longDate(date)}</span>
          </div>

          <button
            type="button"
            className="journal-arrow"
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= todayISO()}
            aria-label="The day after"
          >
            ›
          </button>
        </div>

        <textarea
          className="journal-write"
          value={body}
          onChange={(e) => handleBody(e.target.value)}
          onBlur={() => save()}
          placeholder="…"
          spellCheck="true"
        />

        <div className="journal-foot">
          <span>
            {savedAt
              ? `Saved ${savedAt.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : body
                ? 'Saving as you write'
                : ''}
          </span>
          <span>
            {words > 0 && `${words} ${words === 1 ? 'word' : 'words'}`}
            {streak > 1 && ` · ${streak} days running`}
          </span>
        </div>
      </div>

      <div className="journal-tools">
        {date !== todayISO() && (
          <button type="button" className="row-action-btn" onClick={() => setDate(todayISO())}>
            Back to today
          </button>
        )}
        <input
          type="date"
          className="inline-select"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />
        <Link to="/planning" className="row-action-btn">
          The day&apos;s plan
        </Link>
        <button
          type="button"
          className="row-action-btn"
          onClick={() => setShowShelf((open) => !open)}
        >
          {showShelf ? 'Close the shelf' : `Earlier · ${past.length}`}
        </button>
      </div>

      {showShelf && (
        <div className="card journal-shelf">
          {past.length === 0 ? (
            <p className="empty-text">Nothing written yet.</p>
          ) : (
            <ul className="list">
              {past.map((row) => {
                const isOpen = openId === row.id

                return (
                  <li key={row.id} className="list-row project-row">
                    <div className="task-row-body">
                      <div className="list-row-main task-main">
                        <button
                          type="button"
                          className="shelf-date"
                          onClick={() => setDate(row.entry_date)}
                        >
                          {longDate(row.entry_date)}
                        </button>
                        <span className="list-row-sub">
                          {(row.body || '').trim().slice(0, 90) || 'empty'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => setOpenId(isOpen ? null : row.id)}
                      >
                        {isOpen ? 'Close' : 'Read'}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="learning-detail">
                        <p className="journal-read">{row.body}</p>
                        <div className="task-controls">
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => setDate(row.entry_date)}
                          >
                            Open this day
                          </button>
                          <button
                            type="button"
                            className="row-action-btn row-action-btn-danger"
                            onClick={() => deleteEntry(row.id)}
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
      )}
    </div>
  )
}

export default Journal
