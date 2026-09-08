import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { report } from './lib/report'

const CATEGORIES = [
  { value: 'note', label: 'Note' },
  { value: 'idea', label: 'Idea' },
  { value: 'reference', label: 'Reference' },
  { value: 'someday', label: 'Someday' },
]

const VIEWS = [{ key: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ key: c.value, label: c.label }))]

function NoteList() {
  const navigate = useNavigate()

  const [notes, setNotes] = useState([])
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('note')

  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      report('Failed to load notes', error)
      return
    }

    setNotes(data)
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // A new note opens straight onto its own page, ready to build out.
  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const { data, error } = await supabase
      .from('notes')
      .insert({ title: trimmed, category })
      .select()
      .single()

    if (error) {
      report('Failed to add note', error)
      return
    }

    setTitle('')
    navigate(`/notes/note/${data.id}`)
  }

  async function togglePin(note) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)))

    const { error } = await supabase
      .from('notes')
      .update({ pinned: !note.pinned, updated_at: new Date().toISOString() })
      .eq('id', note.id)

    if (error) {
      report('Failed to update note', error)
      loadNotes()
    }
  }

  const term = search.trim().toLowerCase()
  const visible = notes.filter((note) => {
    if (view !== 'all' && note.category !== view) return false
    if (!term) return true
    return `${note.title || ''} ${note.body || ''}`.toLowerCase().includes(term)
  })

  return (
    <div className="card">
      <form className="quick-add" onSubmit={handleAdd}>
        <input
          type="text"
          className="quick-add-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New note — a title to find it by"
        />
        <div className="field-row">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit">Add note</button>
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

      {notes.length > 3 && (
        <div className="transaction-filter-bar">
          <input
            type="search"
            className="inline-select note-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter these notes"
          />
        </div>
      )}

      {visible.length === 0 ? (
        notes.length === 0 ? (
          <EmptyState icon="📝" title="No notes yet">
            For the things that aren&apos;t tasks — a half-formed idea, a link you want
            later, what someone said on a call. Pin the ones you keep coming back to.
          </EmptyState>
        ) : (
          <p className="empty-text">Nothing in this view.</p>
        )
      ) : (
        <ul className="list">
          {visible.map((note) => {
            const preview = (note.body || '').split('\n')[0].slice(0, 90)

            return (
              <li key={note.id} className={`list-row project-row${note.pinned ? ' note-pinned' : ''}`}>
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`star-button${note.pinned ? ' on' : ''}`}
                    onClick={() => togglePin(note)}
                    aria-label={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    {note.pinned ? '📌' : '📍'}
                  </button>
                  <Link
                    to={`/notes/note/${note.id}`}
                    className="list-row-main task-main client-card-link"
                  >
                    <span className="list-row-title">{note.title || 'Untitled'}</span>
                    <span className="list-row-sub task-meta">
                      <span className="priority-pill">{note.category}</span>
                      {preview && <span>{preview}</span>}
                    </span>
                  </Link>
                  <Link to={`/notes/note/${note.id}`} className="row-action-btn">
                    Open →
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default NoteList
