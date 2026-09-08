import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import TagPicker from './TagPicker'
import EmptyState from './EmptyState'
import NoteAttachments from './NoteAttachments'
import RelatedPages from './RelatedPages'

// A notebook: contents down the side, the open note filling the page.
function Notebook() {
  const { notebookId } = useParams()

  const [notebook, setNotebook] = useState(null)
  const [notes, setNotes] = useState([])
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [newTitle, setNewTitle] = useState('')

  const timer = useRef(null)

  const load = useCallback(async () => {
    const { data: book, error: bookError } = await supabase
      .from('notebooks')
      .select('*')
      .eq('id', notebookId)
      .single()

    if (bookError) {
      report('Failed to load the notebook', bookError)
      return
    }

    setNotebook(book)

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('notebook_id', notebookId)
      .order('sort_order')
      .order('created_at')

    if (error) {
      report('Failed to load notes', error)
      return
    }

    setNotes(data)
    setOpenId((current) => current || data[0]?.id || null)
  }, [notebookId])

  useEffect(() => {
    load()
  }, [load])

  const open = notes.find((note) => note.id === openId) || null

  useEffect(() => {
    setDraft(open?.body || '')
    setSavedAt(null)
  }, [openId, open?.id])

  async function addNote(e) {
    e.preventDefault()

    const trimmed = newTitle.trim()
    if (!trimmed) return

    const { data, error } = await supabase
      .from('notes')
      .insert({ title: trimmed, notebook_id: notebookId, sort_order: notes.length })
      .select()
      .single()

    if (error) {
      report('Failed to add the note', error)
      return
    }

    setNewTitle('')
    setNotes((prev) => [...prev, data])
    setOpenId(data.id)
  }

  async function saveBody(value) {
    if (!open) return

    const { error } = await supabase
      .from('notes')
      .update({ body: value, updated_at: new Date().toISOString() })
      .eq('id', open.id)

    if (error) {
      report('Failed to save the note', error)
      return
    }

    setNotes((prev) => prev.map((note) => (note.id === open.id ? { ...note, body: value } : note)))
    setSavedAt(new Date())
  }

  function handleBody(value) {
    setDraft(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => saveBody(value), 600)
  }

  async function updateNote(id, patch) {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...patch } : note)))

    const { error } = await supabase
      .from('notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      report('Failed to update the note', error)
      load()
    }
  }

  async function deleteNote(id) {
    setNotes((prev) => prev.filter((note) => note.id !== id))
    if (openId === id) setOpenId(null)

    const { error } = await supabase.from('notes').delete().eq('id', id)

    if (error) {
      report('Failed to delete the note', error)
      load()
    }
  }

  if (!notebook) return <p className="empty-text">Loading…</p>

  return (
    <>
      <p className="list-row-sub note-breadcrumb">
        <Link to="/notes" className="project-link">
          Notes
        </Link>
        {' › '}
        <span>{notebook.title}</span>
        {open && (
          <>
            {' › '}
            <span>{open.title || 'Untitled'}</span>
          </>
        )}
      </p>

      <div className="card" style={{ borderLeft: `4px solid ${notebook.color || 'var(--sage)'}` }}>
        <div className="project-scope-header">
          <div>
            <h2>{notebook.title}</h2>
            {notebook.description && <p className="list-row-sub">{notebook.description}</p>}
          </div>
          <Link to="/notes" className="row-action-btn">
            All notebooks
          </Link>
        </div>
        {notebook.area && <span className="priority-pill">{notebook.area}</span>}
      </div>

      <div className="notebook-layout">
        <div className="card notebook-contents">
          <h3 className="budget-group-title">Contents</h3>

          {notes.length === 0 ? (
            <p className="empty-text">Nothing in here yet.</p>
          ) : (
            <ol className="toc">
              {notes.map((note, index) => (
                <li key={note.id}>
                  <button
                    type="button"
                    className={`toc-item${note.id === openId ? ' active' : ''}`}
                    onClick={() => setOpenId(note.id)}
                  >
                    <span className="toc-number">{index + 1}</span>
                    <span className="toc-title">{note.title || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          <form className="mini-form toc-add" onSubmit={addNote}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="new page"
            />
            <button type="submit" className="btn-secondary">
              Add
            </button>
          </form>
        </div>

        <div className="card notebook-page">
          {!open ? (
            <EmptyState icon="📓" title="Pick a page">
              Or start a new one from the contents list. Everything saves as you write.
            </EmptyState>
          ) : (
            <>
              <input
                type="text"
                className="page-title"
                value={open.title || ''}
                placeholder="Untitled"
                onChange={(e) => updateNote(open.id, { title: e.target.value })}
              />

              <textarea
                className="page-body"
                value={draft}
                onChange={(e) => handleBody(e.target.value)}
                placeholder="Write."
              />

              <NoteAttachments noteId={open.id} />

              <RelatedPages noteId={open.id} pages={notes} onOpen={setOpenId} />

              <div className="page-foot">
                <span className="list-row-sub">
                  {savedAt
                    ? `Saved ${savedAt.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : 'Saves as you write.'}
                </span>
                <div className="task-controls">
                  <TagPicker table="notes" id={open.id} />
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => deleteNote(open.id)}
                  >
                    Delete page
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Notebook
