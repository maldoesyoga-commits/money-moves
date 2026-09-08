import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

const CATEGORIES = [
  { value: 'doc', label: 'Docs' },
  { value: 'folder', label: 'Drive folders' },
  { value: 'asset', label: 'Assets' },
  { value: 'link', label: 'Links' },
  { value: 'other', label: 'Other' },
]

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

function Resources() {
  const { brand } = useBrand()

  const [links, setLinks] = useState([])
  const [editingId, setEditingId] = useState(null)

  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('doc')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('brand_links')
      .select('*')
      .eq('brand', brand)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load links (run supabase/resources.sql?):', error.message)
      setLinks([])
      return
    }

    setLinks(data)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmedLabel = label.trim()
    const trimmedUrl = url.trim()
    if (!trimmedLabel || !trimmedUrl) return

    const { error } = await supabase.from('brand_links').insert({
      brand,
      label: trimmedLabel,
      url: trimmedUrl,
      category,
      sort_order: links.length,
    })

    if (error) {
      console.log('Failed to add link', error.message)
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
    const { error } = await supabase.from('brand_links').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save link', error.message)
      load()
    }
  }

  async function deleteLink(id) {
    setLinks((prev) => prev.filter((link) => link.id !== id))
    const { error } = await supabase.from('brand_links').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete link', error.message)
      load()
    }
  }

  const groups = useMemo(() => {
    return CATEGORIES.map((c) => ({
      ...c,
      items: links.filter((link) => (link.category || 'other') === c.value),
    })).filter((group) => group.items.length > 0)
  }, [links])

  function renderLink(link) {
    const editing = editingId === link.id

    return (
      <li key={link.id} className="list-row project-row">
        <div className="task-row-body">
          <div className="list-row-main task-main">
            <a href={link.url} target="_blank" rel="noreferrer" className="list-row-title project-link">
              {link.label} ↗
            </a>
            <span className="list-row-sub link-url">{link.url}</span>
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
  }

  return (
    <div className="brand-tab-body">
      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          <input
            type="text"
            className="quick-add-title"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label — e.g. Brand strategy doc, Logo folder"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
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
      </div>

      {links.length === 0 ? (
        <div className="card">
          <EmptyState icon="🔗" title="No resources yet">
            Drop in links to your Google Drive docs, folders, and assets so everything for
            this brand is one tap away.
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => (
          <div className="card" key={group.value}>
            <div className="project-scope-header">
              <h2>{CAT_LABEL[group.value]}</h2>
              <span className="list-row-sub">{group.items.length}</span>
            </div>
            <ul className="list">{group.items.map(renderLink)}</ul>
          </div>
        ))
      )}
    </div>
  )
}

export default Resources
