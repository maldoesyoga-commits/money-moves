import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function capitalize(text) {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const VALUE_TAGS = ['worth', 'review', 'regret', 'unrated']

const VALUE_TAG_LABELS = {
  worth: 'Worth it',
  review: 'Review',
  regret: 'Regret',
  unrated: 'Unrated',
}

function groupByCategoryGroup(list) {
  const groups = new Map()
  for (const category of list) {
    const key = category.category_group || 'Other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(category)
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

function Categories() {
  const [categories, setCategories] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [targetDrafts, setTargetDrafts] = useState({})

  const [name, setName] = useState('')
  const [categoryGroup, setCategoryGroup] = useState('')
  const [bucket, setBucket] = useState('need')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [editBucket, setEditBucket] = useState('need')

  async function loadCategories() {
    const { data, error } = await supabase.from('categories').select('*')

    if (error) {
      console.error('Failed to load categories', error)
      return
    }

    setCategories(data)
  }

  useEffect(() => {
    loadCategories()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()

    const { error } = await supabase.from('categories').insert({
      name,
      category_group: categoryGroup,
      bucket,
      archived: false,
    })

    if (error) {
      console.log(error.message)
      return
    }

    setName('')
    setCategoryGroup('')
    setBucket('need')
    loadCategories()
  }

  function startEdit(category) {
    setEditingId(category.id)
    setEditName(category.name || '')
    setEditGroup(category.category_group || '')
    setEditBucket(category.bucket || 'need')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(e, id) {
    e.preventDefault()

    const { error } = await supabase
      .from('categories')
      .update({ name: editName, category_group: editGroup, bucket: editBucket })
      .eq('id', id)

    if (error) {
      console.log(error.message)
      return
    }

    setEditingId(null)
    loadCategories()
  }

  async function handleArchive(id) {
    const { error } = await supabase.from('categories').update({ archived: true }).eq('id', id)

    if (error) {
      console.log(error.message)
      return
    }

    if (editingId === id) setEditingId(null)
    loadCategories()
  }

  async function handleValueTagChange(id, newValueTag) {
    if (!VALUE_TAGS.includes(newValueTag)) return

    const { error } = await supabase
      .from('categories')
      .update({ value_tag: newValueTag })
      .eq('id', id)

    if (error) {
      console.log(error.message)
      return
    }

    loadCategories()
  }

  async function handleTargetBlur(category) {
    const draft = targetDrafts[category.id]
    if (draft === undefined) return

    const trimmed = draft.trim()
    const newValue = trimmed === '' ? null : Number(trimmed)

    if (newValue !== null && (Number.isNaN(newValue) || newValue < 0)) return

    const currentValue = category.monthly_target != null ? Number(category.monthly_target) : null
    if (newValue === currentValue) return

    const { error } = await supabase
      .from('categories')
      .update({ monthly_target: newValue })
      .eq('id', category.id)

    if (error) {
      console.log(error.message)
      return
    }

    loadCategories()
  }

  async function handleRestore(id) {
    const { error } = await supabase.from('categories').update({ archived: false }).eq('id', id)

    if (error) {
      console.log(error.message)
      return
    }

    loadCategories()
  }

  const activeCategories = categories.filter((category) => !category.archived)
  const archivedCategories = categories.filter((category) => category.archived)
  const visibleCategories = showArchived ? archivedCategories : activeCategories
  const groupedCategories = groupByCategoryGroup(visibleCategories)

  return (
    <div className="card">
      <h2>Manage categories</h2>

      <form onSubmit={handleAdd}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            required
          />
          <input
            type="text"
            value={categoryGroup}
            onChange={(e) => setCategoryGroup(e.target.value)}
            placeholder="group (e.g. Food)"
          />
          <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
            <option value="need">Need</option>
            <option value="want">Want</option>
            <option value="future">Future</option>
          </select>
        </div>
        <button type="submit">Add category</button>
      </form>

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        {archivedCategories.length > 0 && (
          <span className="list-row-sub">{archivedCategories.length} archived</span>
        )}
      </div>

      {groupedCategories.length === 0 ? (
        <p className="empty-text">
          {showArchived ? 'No archived categories.' : 'No categories yet.'}
        </p>
      ) : (
        groupedCategories.map(({ group, items }) => (
          <div key={group} className="category-group-block">
            <h3>{group}</h3>
            <ul className="list">
              {items.map((category) => (
                <li key={category.id} className="list-row">
                  {editingId === category.id ? (
                    <form
                      className="transaction-edit-form"
                      onSubmit={(e) => handleSaveEdit(e, category.id)}
                    >
                      <div className="field-row">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="name"
                          required
                        />
                        <input
                          type="text"
                          value={editGroup}
                          onChange={(e) => setEditGroup(e.target.value)}
                          placeholder="group"
                        />
                        <select value={editBucket} onChange={(e) => setEditBucket(e.target.value)}>
                          <option value="need">Need</option>
                          <option value="want">Want</option>
                          <option value="future">Future</option>
                        </select>
                      </div>
                      <div className="field-row">
                        <button type="submit">Save</button>
                        <button type="button" className="btn-secondary" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="list-row-main">
                        <span className="list-row-title">{category.name}</span>
                        <span className="list-row-sub">{capitalize(category.bucket)}</span>
                      </div>
                      <div className="subscription-actions">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="target-input"
                          placeholder="No target"
                          aria-label="Monthly target"
                          value={
                            targetDrafts[category.id] ??
                            (category.monthly_target != null ? String(category.monthly_target) : '')
                          }
                          onChange={(e) =>
                            setTargetDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))
                          }
                          onBlur={() => handleTargetBlur(category)}
                        />
                        <select
                          className="inline-select"
                          value={VALUE_TAGS.includes(category.value_tag) ? category.value_tag : 'unrated'}
                          onChange={(e) => handleValueTagChange(category.id, e.target.value)}
                          aria-label="Value rating"
                        >
                          {VALUE_TAGS.map((tag) => (
                            <option key={tag} value={tag}>
                              {VALUE_TAG_LABELS[tag]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => startEdit(category)}
                          aria-label="Edit category"
                        >
                          ✎
                        </button>
                        {showArchived ? (
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => handleRestore(category.id)}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="row-action-btn row-action-btn-danger"
                            onClick={() => handleArchive(category.id)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

export default Categories
