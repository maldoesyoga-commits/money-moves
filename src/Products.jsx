import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

const STATUSES = [
  { value: 'idea', label: 'Idea' },
  { value: 'draft', label: 'In progress' },
  { value: 'live', label: 'Live' },
  { value: 'retired', label: 'Retired' },
]

const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]))

function Products() {
  const { brand } = useBrand()

  const [offers, setOffers] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  const [name, setName] = useState('')
  const [status, setStatus] = useState('idea')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('brand_offers')
      .select('*')
      .eq('brand', brand)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load offers (run supabase/products.sql?):', error.message)
      setOffers([])
      return
    }

    setOffers(data)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('brand_offers')
      .insert({ brand, name: trimmed, status, sort_order: offers.length })

    if (error) {
      console.log('Failed to add offer', error.message)
      return
    }

    setName('')
    load()
  }

  function updateLocal(id, patch) {
    setOffers((prev) => prev.map((offer) => (offer.id === id ? { ...offer, ...patch } : offer)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('brand_offers').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save offer', error.message)
      load()
    }
  }

  async function deleteOffer(id) {
    setOffers((prev) => prev.filter((offer) => offer.id !== id))
    const { error } = await supabase.from('brand_offers').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete offer', error.message)
      load()
    }
  }

  const groups = useMemo(() => {
    return STATUSES.map((s) => ({
      ...s,
      items: offers.filter((offer) => (offer.status || 'idea') === s.value),
    })).filter((group) => group.items.length > 0)
  }, [offers])

  function renderOffer(offer) {
    const open = expandedId === offer.id

    return (
      <li key={offer.id} className="list-row project-row">
        <div className="task-row-body">
          <div className="list-row-main task-main">
            <span className="list-row-title">
              {offer.link ? (
                <a href={offer.link} target="_blank" rel="noreferrer" className="project-link">
                  {offer.name}
                </a>
              ) : (
                offer.name
              )}
            </span>
            <span className="list-row-sub task-meta">
              {offer.price && <span className="offer-price">{offer.price}</span>}
              <span className={`priority-pill status-${offer.status || 'idea'}`}>
                {STATUS_LABEL[offer.status] || 'Idea'}
              </span>
            </span>
          </div>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setExpandedId(open ? null : offer.id)}
          >
            {open ? 'Close' : 'Edit'}
          </button>
        </div>

        {open && (
          <div className="learning-detail">
            <div className="task-controls">
              <input
                type="text"
                className="inline-select"
                value={offer.name}
                onChange={(e) => updateLocal(offer.id, { name: e.target.value })}
                onBlur={(e) => persist(offer.id, { name: e.target.value.trim() || 'Untitled' })}
              />
              <input
                type="text"
                className="inline-select"
                value={offer.price || ''}
                placeholder="price — e.g. $27, free, $12/mo"
                onChange={(e) => updateLocal(offer.id, { price: e.target.value })}
                onBlur={(e) => persist(offer.id, { price: e.target.value.trim() || null })}
              />
              <select
                className="inline-select"
                value={offer.status || 'idea'}
                onChange={(e) => persist(offer.id, { status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="row-action-btn row-action-btn-danger"
                onClick={() => deleteOffer(offer.id)}
              >
                Delete
              </button>
            </div>
            <input
              type="url"
              value={offer.link || ''}
              placeholder="link to the product / sales page (optional)"
              onChange={(e) => updateLocal(offer.id, { link: e.target.value })}
              onBlur={(e) => persist(offer.id, { link: e.target.value.trim() || null })}
            />
            <textarea
              rows="3"
              value={offer.notes || ''}
              placeholder="what it is, who it's for, what's left to do…"
              onChange={(e) => updateLocal(offer.id, { notes: e.target.value })}
              onBlur={(e) => persist(offer.id, { notes: e.target.value || null })}
            />
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New offer — e.g. Gentle Systems template, Weekly letters"
          />
          <div className="field-row">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button type="submit">Add offer</button>
          </div>
        </form>
      </div>

      {offers.length === 0 ? (
        <div className="card">
          <EmptyState icon="🌱" title="No offers yet">
            Track your products and offers here — from first idea through live — with pricing,
            a link, and notes.
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => (
          <div className="card" key={group.value}>
            <div className="project-scope-header">
              <h2>{group.label}</h2>
              <span className="list-row-sub">{group.items.length}</span>
            </div>
            <ul className="list">{group.items.map(renderOffer)}</ul>
          </div>
        ))
      )}
    </div>
  )
}

export default Products
