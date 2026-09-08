import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { DOC_KINDS } from './lib/household'
import { report } from './lib/report'

const KIND_LABEL = Object.fromEntries(DOC_KINDS.map((kind) => [kind.value, kind.label]))

function HouseholdManuals() {
  const [docs, setDocs] = useState([])
  const [items, setItems] = useState([])
  const [openId, setOpenId] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('manual')
  const [link, setLink] = useState('')
  const [itemId, setItemId] = useState('')

  const load = useCallback(async () => {
    const [{ data: docRows, error }, { data: itemRows }] = await Promise.all([
      supabase.from('household_documents').select('*').order('created_at', { ascending: false }),
      supabase.from('household_items').select('id, name, location, brand, model').order('name'),
    ])

    if (error) {
      report('Failed to load documents', error)
      return
    }

    setDocs(docRows || [])
    setItems(itemRows || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addDoc(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const payload = { title: trimmed, kind }
    if (link.trim()) payload.link = link.trim()
    if (itemId) payload.item_id = itemId

    const { error } = await supabase.from('household_documents').insert(payload)

    if (error) {
      report('Failed to add document', error)
      return
    }

    setTitle('')
    setLink('')
    load()
  }

  async function updateDoc(id, patch) {
    setDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)))

    const { error } = await supabase.from('household_documents').update(patch).eq('id', id)

    if (error) {
      report('Failed to update document', error)
      load()
    }
  }

  async function deleteDoc(id) {
    setDocs((prev) => prev.filter((doc) => doc.id !== id))

    const { error } = await supabase.from('household_documents').delete().eq('id', id)

    if (error) {
      report('Failed to delete document', error)
      load()
    }
  }

  function itemFor(id) {
    return items.find((item) => item.id === id) || null
  }

  const visible = docs.filter((doc) => {
    if (kindFilter !== 'all' && doc.kind !== kindFilter) return false
    if (search) {
      const item = itemFor(doc.item_id)
      const haystack = [doc.title, doc.notes, item?.name, item?.brand, item?.model]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  })

  return (
    <>
      <div className="card">
        <h2>Add a document</h2>
        <form onSubmit={addDoc}>
          <div className="field-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="what it is — e.g. Dishwasher manual"
            />
            <select className="inline-select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {DOC_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="inline-select"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">No item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field-row">
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="link to the PDF or the manufacturer's page"
            />
            <button type="submit">Add</button>
          </div>
        </form>
        <p className="list-row-sub">
          This stores the link and the details, not the file itself. Manufacturers keep
          manuals online — a link to theirs stays current in a way a downloaded PDF
          doesn&apos;t. For receipts you actually hold, a Drive link works well.
        </p>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Manuals &amp; documents</h2>
          <span className="list-row-sub">{visible.length}</span>
        </div>

        <div className="transaction-filter-bar">
          <input
            type="search"
            className="inline-select"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search"
          />
          <label className="filter-toggle">
            Kind
            <select
              className="inline-select"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
            >
              <option value="all">All</option>
              {DOC_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="📄" title="No documents yet">
            Manuals, warranties, receipts, insurance paperwork. Link each one to the item
            it belongs to and it shows up when you look that item up.
          </EmptyState>
        ) : (
          <ul className="list">
            {visible.map((doc) => {
              const item = itemFor(doc.item_id)
              const open = openId === doc.id

              return (
                <li key={doc.id} className="list-row">
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      {doc.link ? (
                        <a
                          href={doc.link}
                          target="_blank"
                          rel="noreferrer"
                          className="list-row-title project-link"
                        >
                          {doc.title}
                        </a>
                      ) : (
                        <span className="list-row-title task-title">{doc.title}</span>
                      )}
                      <span className="list-row-sub task-meta">
                        <span className="priority-pill">{KIND_LABEL[doc.kind]}</span>
                        {item && (
                          <span>
                            {item.name}
                            {item.location ? ` · ${item.location}` : ''}
                          </span>
                        )}
                        {item?.model && <span>model {item.model}</span>}
                        {doc.notes && <span>{doc.notes}</span>}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setOpenId(open ? null : doc.id)}
                    >
                      {open ? 'Close' : 'Edit'}
                    </button>
                  </div>

                  {open && (
                    <div className="task-controls">
                      <input
                        type="text"
                        className="inline-select"
                        value={doc.title}
                        onChange={(e) => updateDoc(doc.id, { title: e.target.value })}
                      />
                      <select
                        className="inline-select"
                        value={doc.kind}
                        onChange={(e) => updateDoc(doc.id, { kind: e.target.value })}
                      >
                        {DOC_KINDS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="inline-select"
                        value={doc.item_id || ''}
                        onChange={(e) => updateDoc(doc.id, { item_id: e.target.value || null })}
                      >
                        <option value="">No item</option>
                        {items.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="url"
                        className="inline-select"
                        value={doc.link || ''}
                        placeholder="link"
                        onChange={(e) => updateDoc(doc.id, { link: e.target.value || null })}
                      />
                      <input
                        type="text"
                        className="inline-select"
                        value={doc.notes || ''}
                        placeholder="notes"
                        onChange={(e) => updateDoc(doc.id, { notes: e.target.value || null })}
                      />
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteDoc(doc.id)}
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
    </>
  )
}

export default HouseholdManuals
