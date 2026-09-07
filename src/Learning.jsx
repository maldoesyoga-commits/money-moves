import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { todayISO } from './lib/taskDates'

const VIEWS = [
  { key: 'doing', label: 'In progress' },
  { key: 'someday', label: 'Someday' },
  { key: 'done', label: 'Finished' },
  { key: 'all', label: 'All' },
]

const KINDS = [
  { value: 'course', label: 'Course' },
  { value: 'book', label: 'Book' },
  { value: 'video', label: 'Video' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'article', label: 'Article' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'someday', label: 'Someday' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Finished' },
  { value: 'parked', label: 'Parked' },
]

const KIND_LABEL = Object.fromEntries(KINDS.map((kind) => [kind.value, kind.label]))

function Learning() {
  const [items, setItems] = useState([])
  const [notesByItem, setNotesByItem] = useState({})
  const [view, setView] = useState('doing')
  const [expandedId, setExpandedId] = useState(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('course')
  const [url, setUrl] = useState('')
  const [noteDrafts, setNoteDrafts] = useState({})

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('learning_items')
      .select('*')
      .order('sort_order')
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Failed to load learning items', error.message)
      return
    }

    setItems(data)
  }, [])

  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('learning_notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Failed to load learning notes', error.message)
      return
    }

    const grouped = {}
    data.forEach((note) => {
      grouped[note.item_id] = grouped[note.item_id] || []
      grouped[note.item_id].push(note)
    })

    setNotesByItem(grouped)
  }, [])

  useEffect(() => {
    loadItems()
    loadNotes()
  }, [loadItems, loadNotes])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const payload = { title: trimmed, kind, sort_order: items.length }
    if (url.trim()) payload.url = url.trim()

    const { error } = await supabase.from('learning_items').insert(payload)

    if (error) {
      console.log('Failed to add learning item', error.message)
      return
    }

    setTitle('')
    setUrl('')
    setKind('course')
    loadItems()
  }

  async function updateItem(id, patch) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))

    const { error } = await supabase.from('learning_items').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update learning item', error.message)
      loadItems()
    }
  }

  function changeStatus(item, status) {
    const patch = { status }

    if (status === 'doing' && !item.started_at) patch.started_at = todayISO()
    if (status === 'done') {
      patch.progress = 100
      patch.finished_at = item.finished_at || todayISO()
    }
    if (status !== 'done' && item.finished_at) patch.finished_at = null

    updateItem(item.id, patch)
  }

  function changeProgress(item, progress) {
    const patch = { progress }

    if (progress > 0 && item.status === 'someday') {
      patch.status = 'doing'
      if (!item.started_at) patch.started_at = todayISO()
    }
    if (progress === 100 && item.status !== 'done') {
      patch.status = 'done'
      patch.finished_at = todayISO()
    }

    updateItem(item.id, patch)
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((item) => item.id !== id))

    const { error } = await supabase.from('learning_items').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete learning item', error.message)
      loadItems()
    }
  }

  async function handleAddNote(e, itemId) {
    e.preventDefault()

    const body = (noteDrafts[itemId] || '').trim()
    if (!body) return

    const { error } = await supabase.from('learning_notes').insert({ item_id: itemId, body })

    if (error) {
      console.log('Failed to add note', error.message)
      return
    }

    setNoteDrafts((prev) => ({ ...prev, [itemId]: '' }))
    loadNotes()
  }

  async function deleteNote(id) {
    const { error } = await supabase.from('learning_notes').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete note', error.message)
      return
    }

    loadNotes()
  }

  const visible = items.filter((item) => (view === 'all' ? true : item.status === view))

  function countFor(key) {
    return key === 'all' ? items.length : items.filter((item) => item.status === key).length
  }

  return (
    <section className="learning-module">
      <div className="home-greeting">
        <h1>Learning</h1>
        <p className="list-row-sub">Courses, books and whatever else you&apos;re working through.</p>
      </div>

      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          <input
            type="text"
            className="quick-add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you learning?"
          />
          <div className="field-row">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="link (optional)"
            />
            <button type="submit">Add</button>
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
              <span className="view-tab-count">{countFor(key)}</span>
            </button>
          ))}
        </nav>

        {visible.length === 0 ? (
          items.length === 0 ? (
            <EmptyState icon="📚" title="Nothing on the shelf yet">
              Drop in a course you bought, a book you keep meaning to read, a YouTube
              series — anything you&apos;re working through. Track progress and keep
              notes against each one.
            </EmptyState>
          ) : (
            <p className="empty-text">Nothing in this view.</p>
          )
        ) : (
          <ul className="list">
            {visible.map((item) => {
              const open = expandedId === item.id
              const notes = notesByItem[item.id] || []
              const done = item.status === 'done'

              return (
                <li key={item.id} className={`list-row project-row${done ? ' task-done' : ''}`}>
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title task-title">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="project-link"
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </span>
                      <span className="list-row-sub task-meta">
                        <span className="priority-pill">{KIND_LABEL[item.kind]}</span>
                        <span>{item.progress}%</span>
                        {notes.length > 0 && <span>{notes.length} notes</span>}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setExpandedId(open ? null : item.id)}
                    >
                      {open ? 'Close' : 'Open'}
                    </button>
                  </div>

                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                  </div>

                  {open && (
                    <div className="learning-detail">
                      <div className="task-controls">
                        <select
                          className="inline-select"
                          value={item.status}
                          onChange={(e) => changeStatus(item, e.target.value)}
                        >
                          {STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={item.progress}
                          onChange={(e) => changeProgress(item, Number(e.target.value))}
                        />
                        <select
                          className="inline-select"
                          value={item.rating || ''}
                          onChange={(e) =>
                            updateItem(item.id, { rating: e.target.value ? Number(e.target.value) : null })
                          }
                        >
                          <option value="">No rating</option>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <option key={star} value={star}>
                              {'★'.repeat(star)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => deleteItem(item.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <form className="mini-form note-form" onSubmit={(e) => handleAddNote(e, item.id)}>
                        <input
                          type="text"
                          value={noteDrafts[item.id] || ''}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="Add a note"
                        />
                        <button type="submit" className="btn-secondary">
                          Save note
                        </button>
                      </form>

                      {notes.length > 0 && (
                        <ul className="note-list">
                          {notes.map((note) => (
                            <li key={note.id} className="note-row">
                              <span>{note.body}</span>
                              <button
                                type="button"
                                className="row-action-btn row-action-btn-danger"
                                onClick={() => deleteNote(note.id)}
                              >
                                Delete
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Learning
