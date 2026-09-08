import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

const KINDS = [
  { value: 'strategy', label: 'Strategy' },
  { value: 'identity', label: 'Identity' },
  { value: 'positioning', label: 'Positioning' },
  { value: 'audience', label: 'Audience' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'other', label: 'Other' },
]

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]))

function Strategy() {
  const { brand, kit } = useBrand()

  const [docs, setDocs] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('strategy')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('brand_docs')
      .select('*')
      .eq('brand', brand)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load brand docs (run supabase/strategy.sql?):', error.message)
      setDocs([])
      return
    }

    setDocs(data)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('brand_docs')
      .insert({ brand, title: trimmed, kind, sort_order: docs.length })

    if (error) {
      console.log('Failed to add doc', error.message)
      return
    }

    setTitle('')
    load()
  }

  function updateLocal(id, patch) {
    setDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('brand_docs').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save doc', error.message)
      load()
    }
  }

  async function deleteDoc(id) {
    setDocs((prev) => prev.filter((doc) => doc.id !== id))
    const { error } = await supabase.from('brand_docs').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete doc', error.message)
      load()
    }
  }

  const groups = useMemo(() => {
    return KINDS.map((k) => ({
      ...k,
      items: docs.filter((doc) => (doc.kind || 'other') === k.value),
    })).filter((group) => group.items.length > 0)
  }, [docs])

  function renderDoc(doc) {
    const open = expandedId === doc.id
    const preview = (doc.body || '').split('\n')[0]

    return (
      <li key={doc.id} className="list-row project-row">
        <div className="task-row-body">
          <div className="list-row-main task-main">
            <span className="list-row-title">{doc.title}</span>
            <span className="list-row-sub task-meta">
              <span className="priority-pill">{KIND_LABEL[doc.kind] || 'Other'}</span>
              {doc.link && (
                <a href={doc.link} target="_blank" rel="noreferrer" className="project-link">
                  Drive doc ↗
                </a>
              )}
              {preview && <span className="doc-body-preview">{preview}</span>}
            </span>
          </div>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setExpandedId(open ? null : doc.id)}
          >
            {open ? 'Close' : 'Open'}
          </button>
        </div>

        {open && (
          <div className="learning-detail">
            <div className="task-controls">
              <input
                type="text"
                className="inline-select"
                value={doc.title}
                onChange={(e) => updateLocal(doc.id, { title: e.target.value })}
                onBlur={(e) => persist(doc.id, { title: e.target.value.trim() || 'Untitled' })}
              />
              <select
                className="inline-select"
                value={doc.kind || 'other'}
                onChange={(e) => persist(doc.id, { kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="row-action-btn row-action-btn-danger"
                onClick={() => deleteDoc(doc.id)}
              >
                Delete
              </button>
            </div>

            <textarea
              rows="8"
              value={doc.body || ''}
              placeholder="Write it here — positioning, pillars, voice notes, the real thinking…"
              onChange={(e) => updateLocal(doc.id, { body: e.target.value })}
              onBlur={(e) => persist(doc.id, { body: e.target.value || null })}
            />
            <input
              type="url"
              value={doc.link || ''}
              placeholder="Google Drive link (optional)"
              onChange={(e) => updateLocal(doc.id, { link: e.target.value })}
              onBlur={(e) => persist(doc.id, { link: e.target.value.trim() || null })}
            />
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="brand-tab-body">
      {kit.tagline && (
        <div className="card brand-help-card">
          <span className="brand-kit-eyebrow">North star</span>
          <p className="brand-help-text">{kit.tagline}</p>
        </div>
      )}

      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          <input
            type="text"
            className="quick-add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New doc — e.g. Positioning, Voice, Audience"
          />
          <div className="field-row">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <button type="submit">Add doc</button>
          </div>
        </form>
      </div>

      {docs.length === 0 ? (
        <div className="card">
          <EmptyState icon="🧭" title="No strategy docs yet">
            Add your positioning, brand identity, voice, and audience notes here. Each one
            holds an in-app write-up and can link out to the full Google Drive doc.
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => (
          <div className="card" key={group.value}>
            <div className="project-scope-header">
              <h2>{group.label}</h2>
              <span className="list-row-sub">{group.items.length}</span>
            </div>
            <ul className="list">{group.items.map(renderDoc)}</ul>
          </div>
        ))
      )}
    </div>
  )
}

export default Strategy
