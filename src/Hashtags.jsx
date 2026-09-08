import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

const KINDS = [
  { value: 'core', label: 'Core / always' },
  { value: 'pillar', label: 'Pillar' },
  { value: 'niche', label: 'Niche' },
  { value: 'broad', label: 'Broad reach' },
  { value: 'mixed', label: 'Mixed set' },
]

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]))

function parseTags(raw) {
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
}

function Hashtags() {
  const { brand, kit } = useBrand()

  const [banks, setBanks] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const [name, setName] = useState('')
  const [kind, setKind] = useState('mixed')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('hashtag_banks')
      .select('*')
      .eq('brand', brand)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load hashtag banks (run supabase/hashtags.sql?):', error.message)
      setBanks([])
      return
    }

    setBanks(data)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('hashtag_banks')
      .insert({ brand, name: trimmed, kind, sort_order: banks.length })

    if (error) {
      console.log('Failed to add bank', error.message)
      return
    }

    setName('')
    load()
  }

  function updateLocal(id, patch) {
    setBanks((prev) => prev.map((bank) => (bank.id === id ? { ...bank, ...patch } : bank)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('hashtag_banks').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save bank', error.message)
      load()
    }
  }

  async function deleteBank(id) {
    setBanks((prev) => prev.filter((bank) => bank.id !== id))
    const { error } = await supabase.from('hashtag_banks').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete bank', error.message)
      load()
    }
  }

  function copyBank(bank) {
    const tags = parseTags(bank.tags)
    if (tags.length === 0) return
    try {
      navigator.clipboard.writeText(tags.join(' '))
      setCopiedId(bank.id)
      setTimeout(() => setCopiedId((current) => (current === bank.id ? null : current)), 1400)
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <div className="brand-tab-body">
      {kit.hashtagStrategy && (
        <div className="card brand-help-card">
          <span className="brand-kit-eyebrow">Hashtag strategy</span>
          <p className="brand-help-text">{kit.hashtagStrategy}</p>
        </div>
      )}

      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          <input
            type="text"
            className="quick-add-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New bank — e.g. Recovery Diaries, Broad reach, Core"
          />
          <div className="field-row">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <button type="submit">Add bank</button>
          </div>
        </form>
      </div>

      {banks.length === 0 ? (
        <div className="card">
          <EmptyState icon="#️⃣" title="No hashtag banks yet">
            Build a bank per pillar or reach level. Paste your tags in, and tap Copy to grab
            the whole set when you post.
          </EmptyState>
        </div>
      ) : (
        banks.map((bank) => {
          const tags = parseTags(bank.tags)
          const open = expandedId === bank.id
          const inRange = tags.length >= 10 && tags.length <= 15

          return (
            <div className="card" key={bank.id}>
              <div className="project-scope-header">
                <h2>{bank.name}</h2>
                <div className="bank-header-actions">
                  <span className={`tag-count${inRange ? ' good' : ''}`}>
                    {tags.length} tag{tags.length === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => copyBank(bank)}
                    disabled={tags.length === 0}
                  >
                    {copiedId === bank.id ? 'Copied ✓' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setExpandedId(open ? null : bank.id)}
                  >
                    {open ? 'Close' : 'Edit'}
                  </button>
                </div>
              </div>

              <span className="priority-pill">{KIND_LABEL[bank.kind] || 'Set'}</span>

              {tags.length > 0 && (
                <div className="hashtag-chips">
                  {tags.map((tag, index) => (
                    <span key={`${tag}-${index}`} className="hashtag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {bank.strategy && !open && <p className="doc-body-preview">{bank.strategy}</p>}

              {open && (
                <div className="learning-detail">
                  <div className="task-controls">
                    <input
                      type="text"
                      className="inline-select"
                      value={bank.name}
                      onChange={(e) => updateLocal(bank.id, { name: e.target.value })}
                      onBlur={(e) => persist(bank.id, { name: e.target.value.trim() || 'Untitled' })}
                    />
                    <select
                      className="inline-select"
                      value={bank.kind || 'mixed'}
                      onChange={(e) => persist(bank.id, { kind: e.target.value })}
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
                      onClick={() => deleteBank(bank.id)}
                    >
                      Delete
                    </button>
                  </div>

                  <textarea
                    rows="5"
                    value={bank.tags || ''}
                    placeholder="#creatingmal #softproductivity #nervoussystem …  (spaces or new lines, # optional)"
                    onChange={(e) => updateLocal(bank.id, { tags: e.target.value })}
                    onBlur={(e) => persist(bank.id, { tags: e.target.value || null })}
                  />
                  <input
                    type="text"
                    value={bank.strategy || ''}
                    placeholder="When to use this bank (optional)"
                    onChange={(e) => updateLocal(bank.id, { strategy: e.target.value })}
                    onBlur={(e) => persist(bank.id, { strategy: e.target.value.trim() || null })}
                  />
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default Hashtags
