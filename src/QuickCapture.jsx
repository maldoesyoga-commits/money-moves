import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'
import { startFocus, DEFAULT_MINUTES } from './lib/focus'
import { useNavigate } from 'react-router-dom'
import { report } from './lib/report'

const KINDS = [
  { key: 'task', label: 'Task', placeholder: 'What needs doing?' },
  { key: 'idea', label: 'Content idea', placeholder: 'The idea, in a few words' },
  { key: 'grocery', label: 'Grocery', placeholder: 'What to buy' },
  { key: 'learning', label: 'To learn', placeholder: 'Course, book, video…' },
  { key: 'note', label: 'Note', placeholder: 'Jot it down' },
]

function QuickCapture() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('task')
  const [text, setText] = useState('')
  const [dueToday, setDueToday] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, kind])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleSave(e) {
    e.preventDefault()

    const trimmed = text.trim()
    if (!trimmed) return

    setSaving(true)

    let table = 'tasks'
    let payload = { title: trimmed, status: 'todo' }

    if (kind === 'task' && dueToday) payload.due_date = todayISO()

    if (kind === 'idea') {
      table = 'content_items'
      payload = { title: trimmed }
    }

    if (kind === 'grocery') {
      table = 'grocery_items'
      payload = { name: trimmed }
    }

    if (kind === 'learning') {
      table = 'learning_items'
      payload = { title: trimmed }
    }

    if (kind === 'note') {
      table = 'notes'
      payload = { title: trimmed }
    }

    const { error } = await supabase.from(table).insert(payload)

    setSaving(false)

    if (error) {
      report('Quick capture failed', error)
      setFlash("Couldn't save that.")
      return
    }

    setText('')
    setFlash('Caught it.')
    setTimeout(() => setFlash(null), 1600)
    inputRef.current?.focus()
  }

  if (!open) {
    return (
      <button
        type="button"
        className="capture-fab"
        onClick={() => setOpen(true)}
        aria-label="Quick capture"
      >
        +
      </button>
    )
  }

  const active = KINDS.find((option) => option.key === kind)

  return (
    <div className="capture-sheet" role="dialog" aria-label="Quick capture">
      <div className="capture-head">
        <strong>Quick capture</strong>
        <button
          type="button"
          className="row-action-btn"
          onClick={() => {
            startFocus({ minutes: DEFAULT_MINUTES, label: text.trim() })
            setOpen(false)
            navigate('/focus')
          }}
          title={`Start a ${DEFAULT_MINUTES} minute focus block`}
        >
          Focus 50
        </button>
        <button
          type="button"
          className="row-action-btn"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          Close
        </button>
      </div>

      <div className="view-tabs capture-tabs">
        {KINDS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`view-tab${kind === option.key ? ' active' : ''}`}
            onClick={() => setKind(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={active.placeholder}
        />

        <div className="capture-actions">
          {kind === 'task' && (
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={dueToday}
                onChange={(e) => setDueToday(e.target.checked)}
              />
              Due today
            </label>
          )}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {flash && <p className="capture-flash">{flash}</p>}
    </div>
  )
}

export default QuickCapture
