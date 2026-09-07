import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import TagPicker from './TagPicker'
import EmptyState from './EmptyState'
import { todayISO, formatDueDate } from './lib/taskDates'

const STAGES = [
  { value: 'idea', label: 'Idea' },
  { value: 'scripted', label: 'Scripted' },
  { value: 'filmed', label: 'Filmed' },
  { value: 'edited', label: 'Edited' },
  { value: 'posted', label: 'Posted' },
]

const PIPELINE = STAGES.map((stage) => stage.value)

const BRANDS = [
  { value: 'cm', label: 'Creating Mal' },
  { value: 'hh', label: 'Hope Heals' },
  { value: 'om', label: 'Ollie & Me' },
  { value: 'other', label: 'Other' },
]

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'blog', label: 'Blog' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
]

const FORMATS = [
  { value: 'reel', label: 'Reel' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'story', label: 'Story' },
  { value: 'post', label: 'Post' },
  { value: 'video', label: 'Video' },
  { value: 'short', label: 'Short' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'other', label: 'Other' },
]

const BRAND_LABEL = Object.fromEntries(BRANDS.map((brand) => [brand.value, brand.label]))
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]))

function Content() {
  const [items, setItems] = useState([])
  const [brandFilter, setBrandFilter] = useState('all')
  const [showParked, setShowParked] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('cm')
  const [platform, setPlatform] = useState('instagram')

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .order('publish_date', { nullsFirst: false })
      .order('created_at')

    if (error) {
      console.log('Failed to load content items', error.message)
      return
    }

    setItems(data)
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('content_items')
      .insert({ title: trimmed, brand, platform, sort_order: items.length })

    if (error) {
      console.log('Failed to add content item', error.message)
      return
    }

    setTitle('')
    loadItems()
  }

  async function updateItem(id, patch) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))

    const { error } = await supabase.from('content_items').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update content item', error.message)
      loadItems()
    }
  }

  function moveStage(item, delta) {
    const index = PIPELINE.indexOf(item.stage)
    const nextIndex = Math.min(PIPELINE.length - 1, Math.max(0, (index === -1 ? 0 : index) + delta))
    const stage = PIPELINE[nextIndex]

    const patch = { stage }
    if (stage === 'posted') patch.posted_at = item.posted_at || todayISO()
    if (stage !== 'posted' && item.posted_at) patch.posted_at = null

    updateItem(item.id, patch)
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((item) => item.id !== id))

    const { error } = await supabase.from('content_items').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete content item', error.message)
      loadItems()
    }
  }

  const filtered = items.filter((item) => {
    if (brandFilter !== 'all' && item.brand !== brandFilter) return false
    if (!showParked && item.stage === 'parked') return false
    return true
  })

  function renderItem(item) {
    const open = expandedId === item.id
    const index = PIPELINE.indexOf(item.stage)
    const overdue =
      item.stage !== 'posted' && item.publish_date && item.publish_date < todayISO()

    return (
      <li key={item.id} className="list-row project-row">
        <div className="task-row-body">
          <span className={`brand-dot brand-${item.brand}`} />
          <div className="list-row-main task-main">
            <span className="list-row-title">
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer" className="project-link">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </span>
            <span className="list-row-sub task-meta">
              <span>{BRAND_LABEL[item.brand]}</span>
              <span>{PLATFORM_LABEL[item.platform]}</span>
              {item.format && <span className="priority-pill">{item.format}</span>}
              {item.publish_date && (
                <span className={overdue ? 'task-overdue' : undefined}>
                  {formatDueDate(item.publish_date)}
                </span>
              )}
            </span>
          </div>
          <div className="stage-nudge">
            <button
              type="button"
              className="row-action-btn"
              onClick={() => moveStage(item, -1)}
              disabled={index <= 0}
              aria-label="Move back a stage"
            >
              ‹
            </button>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => moveStage(item, 1)}
              disabled={index === PIPELINE.length - 1}
              aria-label="Move forward a stage"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setExpandedId(open ? null : item.id)}
          >
            {open ? 'Close' : 'Edit'}
          </button>
        </div>

        {open && (
          <div className="learning-detail">
            <div className="task-controls">
              <select
                className="inline-select"
                value={item.brand}
                onChange={(e) => updateItem(item.id, { brand: e.target.value })}
              >
                {BRANDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="inline-select"
                value={item.platform}
                onChange={(e) => updateItem(item.id, { platform: e.target.value })}
              >
                {PLATFORMS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="inline-select"
                value={item.format || ''}
                onChange={(e) => updateItem(item.id, { format: e.target.value || null })}
              >
                <option value="">No format</option>
                {FORMATS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className="inline-select"
                value={item.stage}
                onChange={(e) => updateItem(item.id, { stage: e.target.value })}
              >
                {[...STAGES, { value: 'parked', label: 'Parked' }].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="inline-select"
                value={item.publish_date || ''}
                onChange={(e) => updateItem(item.id, { publish_date: e.target.value || null })}
              />
              <button
                type="button"
                className="row-action-btn row-action-btn-danger"
                onClick={() => deleteItem(item.id)}
              >
                Delete
              </button>
              <TagPicker table="content_items" id={item.id} />
            </div>

            <input
              type="text"
              value={item.hook || ''}
              placeholder="hook / opening line"
              onChange={(e) => updateItem(item.id, { hook: e.target.value || null })}
            />
            <textarea
              rows="3"
              value={item.notes || ''}
              placeholder="script, shot list, caption notes"
              onChange={(e) => updateItem(item.id, { notes: e.target.value || null })}
            />
            <input
              type="url"
              value={item.link || ''}
              placeholder="link to the post or the file"
              onChange={(e) => updateItem(item.id, { link: e.target.value || null })}
            />
          </div>
        )}
      </li>
    )
  }

  return (
    <section className="content-module">
      <div className="home-greeting">
        <h1>Content</h1>
        <p className="list-row-sub">Idea → scripted → filmed → edited → posted.</p>
      </div>

      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          <input
            type="text"
            className="quick-add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New idea"
          />
          <div className="field-row">
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              {BRANDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit">Capture</button>
          </div>
        </form>

        <div className="transaction-filter-bar">
          <label className="filter-toggle">
            Brand
            <select
              className="inline-select"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="all">All</option>
              {BRANDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showParked}
              onChange={(e) => setShowParked(e.target.checked)}
            />
            Show parked
          </label>
        </div>
      </div>

      {items.length === 0 && (
        <div className="card">
          <EmptyState icon="🎬" title="Nothing in the pipeline">
            Capture an idea above and it lands in the Idea stage. Use the ‹ › buttons on
            a card to walk it along — scripted, filmed, edited, posted.
          </EmptyState>
        </div>
      )}

      {items.length > 0 && STAGES.map((stage) => {
        const stageItems = filtered.filter((item) => item.stage === stage.value)

        return (
          <div className="card" key={stage.value}>
            <div className="project-scope-header">
              <h2>{stage.label}</h2>
              <span className="list-row-sub">{stageItems.length}</span>
            </div>
            {stageItems.length === 0 ? (
              <p className="empty-text">Nothing at this stage.</p>
            ) : (
              <ul className="list">{stageItems.map(renderItem)}</ul>
            )}
          </div>
        )
      })}

      {showParked && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Parked</h2>
            <span className="list-row-sub">
              {filtered.filter((item) => item.stage === 'parked').length}
            </span>
          </div>
          {filtered.filter((item) => item.stage === 'parked').length === 0 ? (
            <p className="empty-text">Nothing parked.</p>
          ) : (
            <ul className="list">
              {filtered.filter((item) => item.stage === 'parked').map(renderItem)}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

export default Content
