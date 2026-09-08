import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { report } from './lib/report'

const CATEGORIES = [
  { value: 'doc', label: 'Doc' },
  { value: 'folder', label: 'Folder' },
  { value: 'asset', label: 'Asset' },
  { value: 'link', label: 'Link' },
  { value: 'other', label: 'Other' },
]

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

// Links and references that belong to a project — Drive docs, folders, assets.
// Reads and writes project_links (supabase/project-resources.sql). Drop it into
// a project page with either projectId or freelanceProjectId.
function ProjectResources({ projectId, freelanceProjectId }) {
  const column = projectId
    ? 'project_id'
    : freelanceProjectId
      ? 'freelance_project_id'
      : null
  const value = projectId || freelanceProjectId || null

  const [links, setLinks] = useState([])
  const [editingId, setEditingId] = useState(null)

  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('link')

  const load = useCallback(async () => {
    if (!column) return

    const { data, error } = await supabase
      .from('project_links')
      .select('*')
      .eq(column, value)
      .order('sort_order')
      .order('created_at')

    if (error) {
      report('Failed to load resources — run supabase/project-resources.sql?', error)
      setLinks([])
      return
    }

    setLinks(data)
  }, [column, value])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmedLabel = label.trim()
    const trimmedUrl = url.trim()
    if (!trimmedLabel || !trimmedUrl || !column) return

    const { error } = await supabase.from('project_links').insert({
      label: trimmedLabel,
      url: trimmedUrl,
      category,
      [column]: value,
      sort_order: links.length,
    })

    if (error) {
      report('Failed to add the resource', error)
      return
    }

    setLabel('')
    setUrl('')
    load()
  }

  function updateLocal(id, patch) {
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, ...patch } : link)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('project_links').update(patch).eq('id', id)
    if (error) {
      report('Failed to save the resource', error)
      load()
    }
  }

  async function deleteLink(id) {
    setLinks((prev) => prev.filter((link) => link.id !== id))
    const { error } = await supabase.from('project_links').delete().eq('id', id)
    if (error) {
      report('Failed to delete the resource', error)
      load()
    }
  }

  return (
    <div className="card">
      <h2>Resources</h2>
      <p className="list-row-sub">
        Links that live with this project — Drive docs, folders, assets, references.
      </p>

      <form className="quick-add" onSubmit={handleAdd}>
        <input
          type="text"
          className="quick-add-title"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label — e.g. Brief doc, Asset folder"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
        <div className="field-row">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit">Add link</button>
        </div>
      </form>

      {links.length === 0 ? (
        <EmptyState icon="🔗" title="No resources yet">
          Drop in the links this project needs so they&apos;re one tap away.
        </EmptyState>
      ) : (
        <ul className="list">
          {links.map((link) => {
            const editing = editingId === link.id

            return (
              <li key={link.id} className="list-row project-row">
                <div className="task-row-body">
                  <div className="list-row-main task-main">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="list-row-title project-link"
                    >
                      {link.label} ↗
                    </a>
                    <span className="list-row-sub task-meta">
                      <span className="priority-pill">{CAT_LABEL[link.category] || 'Other'}</span>
                      <span className="link-url">{link.url}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setEditingId(editing ? null : link.id)}
                  >
                    {editing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {editing && (
                  <div className="task-controls">
                    <input
                      type="text"
                      className="inline-select"
                      value={link.label}
                      onChange={(e) => updateLocal(link.id, { label: e.target.value })}
                      onBlur={(e) => persist(link.id, { label: e.target.value.trim() || 'Untitled' })}
                    />
                    <input
                      type="url"
                      className="inline-select"
                      value={link.url}
                      onChange={(e) => updateLocal(link.id, { url: e.target.value })}
                      onBlur={(e) => persist(link.id, { url: e.target.value.trim() })}
                    />
                    <select
                      className="inline-select"
                      value={link.category || 'other'}
                      onChange={(e) => persist(link.id, { category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="row-action-btn row-action-btn-danger"
                      onClick={() => deleteLink(link.id)}
                    >
                      Delete
                    </button>
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

export default ProjectResources
