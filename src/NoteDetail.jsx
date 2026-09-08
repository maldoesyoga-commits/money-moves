import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import TagPicker from './TagPicker'
import NoteAttachments from './NoteAttachments'
import { report } from './lib/report'

const CATEGORIES = [
  { value: 'note', label: 'Note' },
  { value: 'idea', label: 'Idea' },
  { value: 'reference', label: 'Reference' },
  { value: 'someday', label: 'Someday' },
]

// One note, on its own page — room to go deep, keep the references with it, and
// let it grow over time.
function NoteDetail() {
  const { noteId } = useParams()
  const navigate = useNavigate()

  const [note, setNote] = useState(null)
  const [notebooks, setNotebooks] = useState([])
  const [projects, setProjects] = useState([])
  const [draft, setDraft] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  const timer = useRef(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('notes').select('*').eq('id', noteId).single()

    if (error) {
      report('Failed to load the note', error)
      return
    }

    setNote(data)
    setDraft(data.body || '')

    const [{ data: bookRows }, { data: projectRows }] = await Promise.all([
      supabase.from('notebooks').select('id, title').eq('archived', false).order('title'),
      supabase.from('projects').select('id, name').order('name'),
    ])

    setNotebooks(bookRows || [])
    setProjects(projectRows || [])
  }, [noteId])

  useEffect(() => {
    load()
  }, [load])

  async function updateNote(patch) {
    setNote((prev) => ({ ...prev, ...patch }))

    const { error } = await supabase
      .from('notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', noteId)

    if (error) {
      report('Failed to update the note', error)
      load()
    }
  }

  // Body saves on a short pause rather than every keystroke.
  function handleBody(value) {
    setDraft(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const { error } = await supabase
        .from('notes')
        .update({ body: value, updated_at: new Date().toISOString() })
        .eq('id', noteId)
      if (error) {
        report('Failed to save the note', error)
        return
      }
      setNote((prev) => ({ ...prev, body: value }))
      setSavedAt(new Date())
    }, 600)
  }

  async function deleteNote() {
    if (!window.confirm('Delete this note? This can’t be undone.')) return

    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) {
      report('Failed to delete the note', error)
      return
    }
    navigate('/notes/all')
  }

  if (!note) return <p className="empty-text">Loading…</p>

  return (
    <>
      <div className="card">
        <div className="project-scope-header">
          <button
            type="button"
            className={`star-button${note.pinned ? ' on' : ''}`}
            onClick={() => updateNote({ pinned: !note.pinned })}
            aria-label={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? '📌' : '📍'}
          </button>
          <Link to="/notes/all" className="row-action-btn">
            All notes
          </Link>
        </div>

        <input
          type="text"
          className="page-title"
          value={note.title || ''}
          placeholder="Untitled"
          onChange={(e) => updateNote({ title: e.target.value })}
        />

        <textarea
          className="page-body"
          value={draft}
          placeholder="Write it all out — what this is, what it means, where it's going."
          onChange={(e) => handleBody(e.target.value)}
        />

        <p className="list-row-sub">
          {savedAt
            ? `Saved ${savedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : 'Saves as you write.'}
        </p>

        <div className="task-controls">
          <select
            className="inline-select"
            value={note.category}
            onChange={(e) => updateNote({ category: e.target.value })}
          >
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="inline-select"
            value={note.notebook_id || ''}
            onChange={(e) => updateNote({ notebook_id: e.target.value || null })}
          >
            <option value="">No notebook</option>
            {notebooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <select
            className="inline-select"
            value={note.project_id || ''}
            onChange={(e) => updateNote({ project_id: e.target.value || null })}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <TagPicker table="notes" id={note.id} />
          <button
            type="button"
            className="row-action-btn row-action-btn-danger"
            onClick={deleteNote}
          >
            Delete
          </button>
        </div>

        <NoteAttachments noteId={note.id} />
      </div>
    </>
  )
}

export default NoteDetail
