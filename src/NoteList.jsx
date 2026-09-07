import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import TagPicker from './TagPicker'
import EmptyState from './EmptyState'

const CATEGORIES = [
  { value: 'note', label: 'Note' },
  { value: 'idea', label: 'Idea' },
  { value: 'reference', label: 'Reference' },
  { value: 'someday', label: 'Someday' },
]

const VIEWS = [{ key: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ key: c.value, label: c.label }))]

function NoteList() {
  const [notes, setNotes] = useState([])
  const [projects, setProjects] = useState([])
  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [drafts, setDrafts] = useState({})

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('note')

  const timers = useRef({})

  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) {
      console.log('Failed to load notes', error.message)
      return
    }

    setNotes(data)
  }, [])

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase.from('projects').select('id, name').order('name')

    if (error) {
      console.log('Failed to load projects', error.message)
      return
    }

    setProjects(data)
  }, [])

  useEffect(() => {
    loadNotes()
    loadProjects()
  }, [loadNotes, loadProjects])

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
      console.log('Failed to add note', error.message)
      return
    }

    setTitle('')
    setOpenId(data.id)
    loadNotes()
  }

  async function updateNote(id, patch) {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...patch } : note)))

    const { error } = await supabase
      .from('notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.log('Failed to update note', error.message)
      loadNotes()
    }
  }

  // Body edits debounce so a long note isn't a write per keystroke.
  function handleBody(id, value) {
    setDrafts((prev) => ({ ...prev, [id]: value }))

    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => updateNote(id, { body: value }), 600)
  }

  async function deleteNote(id) {
    setNotes((prev) => prev.filter((note) => note.id !== id))

    const { error } = await supabase.from('notes').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete note', error.message)
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
            const open = openId === note.id
            const body = drafts[note.id] ?? note.body ?? ''
            const preview = (note.body || '').split('\n')[0].slice(0, 90)

            return (
              <li key={note.id} className={`list-row project-row${note.pinned ? ' note-pinned' : ''}`}>
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`star-button${note.pinned ? ' on' : ''}`}
                    onClick={() => updateNote(note.id, { pinned: !note.pinned })}
                    aria-label={note.pinned ? 'Unpin' : 'Pin'}
                  >
                    {note.pinned ? '📌' : '📍'}
                  </button>
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{note.title || 'Untitled'}</span>
                    <span className="list-row-sub task-meta">
                      <span className="priority-pill">{note.category}</span>
                      {preview && <span>{preview}</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setOpenId(open ? null : note.id)}
                  >
                    {open ? 'Close' : 'Open'}
                  </button>
                </div>

                {open && (
                  <div className="learning-detail">
                    <input
                      type="text"
                      value={note.title || ''}
                      placeholder="title"
                      onChange={(e) => updateNote(note.id, { title: e.target.value })}
                    />
                    <textarea
                      rows="8"
                      value={body}
                      placeholder="Write it all out here."
                      onChange={(e) => handleBody(note.id, e.target.value)}
                    />
                    <div className="task-controls">
                      <select
                        className="inline-select"
                        value={note.category}
                        onChange={(e) => updateNote(note.id, { category: e.target.value })}
                      >
                        {CATEGORIES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="inline-select"
                        value={note.project_id || ''}
                        onChange={(e) =>
                          updateNote(note.id, { project_id: e.target.value || null })
                        }
                      >
                        <option value="">No project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteNote(note.id)}
                      >
                        Delete
                      </button>
                      <TagPicker table="notes" id={note.id} />
                    </div>
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

export default NoteList
