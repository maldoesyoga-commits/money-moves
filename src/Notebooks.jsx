import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import EmptyState from './EmptyState'

const AREAS = ['Creating Mal', 'Hope Heals', 'Ollie & Me', 'Personal', 'Household', 'Learning']
const COLORS = ['#3f6b5c', '#b87333', '#4e6e8a', '#bf8f6b', '#6e7a75']

function Notebooks() {
  const [notebooks, setNotebooks] = useState([])
  const [counts, setCounts] = useState({})
  const [loose, setLoose] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notebooks')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (error) {
      report('Failed to load notebooks', error)
      return
    }

    setNotebooks(data)

    const { data: noteRows, error: noteError } = await supabase
      .from('notes')
      .select('id, notebook_id')

    if (noteError) {
      report('Failed to count notes', noteError)
      return
    }

    const next = {}
    let without = 0
    noteRows.forEach((note) => {
      if (!note.notebook_id) without += 1
      else next[note.notebook_id] = (next[note.notebook_id] || 0) + 1
    })

    setCounts(next)
    setLoose(without)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const payload = {
      title: trimmed,
      color: COLORS[notebooks.length % COLORS.length],
      sort_order: notebooks.length,
    }
    if (description.trim()) payload.description = description.trim()
    if (area.trim()) payload.area = area.trim()

    const { error } = await supabase.from('notebooks').insert(payload)

    if (error) {
      report('Failed to create the notebook', error)
      return
    }

    setTitle('')
    setDescription('')
    setArea('')
    load()
  }

  async function updateNotebook(id, patch) {
    setNotebooks((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('notebooks').update(patch).eq('id', id)

    if (error) {
      report('Failed to update the notebook', error)
      load()
    }
  }

  async function deleteNotebook(id) {
    setNotebooks((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('notebooks').delete().eq('id', id)

    if (error) {
      report('Failed to delete the notebook', error)
      load()
      return
    }

    load()
  }

  const visible = notebooks.filter((row) => showArchived || !row.archived)
  const areas = [...new Set(visible.map((row) => row.area || 'Unfiled'))]

  return (
    <>
      <div className="card">
        <h2>New notebook</h2>
        <form onSubmit={handleCreate}>
          <div className="field-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="notebook title"
            />
            <input
              type="text"
              list="notebook-areas"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="area"
            />
            <datalist id="notebook-areas">
              {[...new Set([...AREAS, ...notebooks.map((row) => row.area).filter(Boolean)])].map(
                (name) => (
                  <option key={name} value={name} />
                ),
              )}
            </datalist>
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="what goes in here"
          />
          <button type="submit">Create notebook</button>
        </form>

        {notebooks.length > 0 && (
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
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <EmptyState icon="📓" title="No notebooks yet">
            A notebook is a topic — one per client, one for the shop, one for whatever
            you keep thinking about. Give it a title and an area, then write inside it.
          </EmptyState>
          {loose > 0 && (
            <p className="list-row-sub">
              You have {loose} loose {loose === 1 ? 'note' : 'notes'} —{' '}
              <Link to="/notes/all" className="project-link">
                see them
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        areas.map((areaName) => (
          <div className="card" key={areaName}>
            <h3 className="budget-group-title">{areaName}</h3>

            <div className="notebook-grid">
              {visible
                .filter((row) => (row.area || 'Unfiled') === areaName)
                .map((notebook) => (
                  <div className="notebook-card" key={notebook.id}>
                    <Link
                      to={`/notes/book/${notebook.id}`}
                      className="notebook-face"
                      style={{ '--book-color': notebook.color || 'var(--sage)' }}
                    >
                      <span className="notebook-title">{notebook.title}</span>
                      {notebook.description && (
                        <span className="notebook-desc">{notebook.description}</span>
                      )}
                      <span className="notebook-count">
                        {counts[notebook.id] || 0} {counts[notebook.id] === 1 ? 'note' : 'notes'}
                      </span>
                    </Link>

                    <button
                      type="button"
                      className="row-action-btn notebook-edit"
                      onClick={() => setEditingId(editingId === notebook.id ? null : notebook.id)}
                    >
                      {editingId === notebook.id ? 'Close' : 'Edit'}
                    </button>

                    {editingId === notebook.id && (
                      <div className="learning-detail">
                        <input
                          type="text"
                          value={notebook.title}
                          onChange={(e) => updateNotebook(notebook.id, { title: e.target.value })}
                        />
                        <input
                          type="text"
                          value={notebook.description || ''}
                          placeholder="description"
                          onChange={(e) =>
                            updateNotebook(notebook.id, { description: e.target.value || null })
                          }
                        />
                        <input
                          type="text"
                          list="notebook-areas"
                          value={notebook.area || ''}
                          placeholder="area"
                          onChange={(e) =>
                            updateNotebook(notebook.id, { area: e.target.value || null })
                          }
                        />
                        <div className="color-picker-row">
                          {COLORS.map((swatch) => (
                            <button
                              key={swatch}
                              type="button"
                              className={`color-swatch${notebook.color === swatch ? ' selected' : ''}`}
                              style={{ background: swatch }}
                              onClick={() => updateNotebook(notebook.id, { color: swatch })}
                              aria-label={`Colour ${swatch}`}
                            />
                          ))}
                        </div>
                        <div className="task-controls">
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() =>
                              updateNotebook(notebook.id, { archived: !notebook.archived })
                            }
                          >
                            {notebook.archived ? 'Restore' : 'Archive'}
                          </button>
                          <button
                            type="button"
                            className="row-action-btn row-action-btn-danger"
                            onClick={() => deleteNotebook(notebook.id)}
                          >
                            Delete notebook
                          </button>
                        </div>
                        <p className="list-row-sub">
                          Deleting a notebook keeps its notes — they become loose notes.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))
      )}

      {loose > 0 && visible.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h3 className="budget-group-title">Loose notes</h3>
            <Link to="/notes/all" className="row-action-btn">
              {loose} unfiled
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

export default Notebooks
