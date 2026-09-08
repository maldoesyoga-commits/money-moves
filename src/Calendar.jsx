import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import { todayISO, formatDueDate } from './lib/taskDates'
import EmptyState from './EmptyState'

const STAGES = [
  { value: 'idea', label: 'Idea' },
  { value: 'scripted', label: 'Scripted' },
  { value: 'filmed', label: 'Filmed' },
  { value: 'edited', label: 'Edited' },
  { value: 'posted', label: 'Posted' },
  { value: 'parked', label: 'Parked' },
]
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]))

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
const FORMAT_LABEL = Object.fromEntries(FORMATS.map((f) => [f.value, f.label]))

const PLATFORM_LABEL = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  blog: 'Blog',
  email: 'Email',
  other: 'Other',
}

const VIEWS = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'list', label: 'List' },
  { key: 'type', label: 'By type' },
  { key: 'status', label: 'By status' },
]

const VIEW_STORAGE_KEY = 'homestead.calendarView'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function ContentCard({ item, compact, onSelect, draggable }) {
  const overdue = item.stage !== 'posted' && item.publish_date && item.publish_date < todayISO()
  return (
    <div
      className={`content-card${compact ? ' compact' : ''}${draggable ? ' draggable' : ''}`}
      role="button"
      tabIndex={0}
      draggable={draggable || undefined}
      onDragStart={draggable ? (e) => e.dataTransfer.setData('text/plain', item.id) : undefined}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(item)
        }
      }}
    >
      <span className={`stage-flag stage-${item.stage}`} />
      <span className="content-card-main">
        <span className="content-card-title">{item.title}</span>
        <span className="content-card-meta">
          {item.publish_date && (
            <span className={overdue ? 'task-overdue' : undefined}>
              {formatDueDate(item.publish_date)}
            </span>
          )}
          {item.platform && <span>{PLATFORM_LABEL[item.platform] || item.platform}</span>}
          {item.format && <span className="priority-pill">{FORMAT_LABEL[item.format] || item.format}</span>}
        </span>
      </span>
    </div>
  )
}

function ContentDetail({ item, onClose, onUpdate }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{item.title}</h2>
          <button type="button" className="row-action-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-meta">
          {item.publish_date && <span>{formatDueDate(item.publish_date)}</span>}
          {item.platform && <span>{PLATFORM_LABEL[item.platform] || item.platform}</span>}
        </div>

        <div className="modal-fields">
          <label>
            Stage
            <select value={item.stage} onChange={(e) => onUpdate(item.id, { stage: e.target.value })}>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select
              value={item.format || ''}
              onChange={(e) => onUpdate(item.id, { format: e.target.value || null })}
            >
              <option value="">No format</option>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {item.hook && <p className="modal-hook">“{item.hook}”</p>}
        {item.notes && <p className="modal-notes">{item.notes}</p>}

        <div className="modal-actions">
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" className="row-action-btn">
              Open link ↗
            </a>
          )}
          <Link to="/content" className="row-action-btn">
            Edit in Content →
          </Link>
        </div>
      </div>
    </div>
  )
}

function Kanban({ columns, dimension, onSelect, onMove }) {
  const [overKey, setOverKey] = useState(null)

  return (
    <div className="kanban">
      {columns.map((col) => (
        <div
          className={`kanban-col${overKey === col.key ? ' drag-over' : ''}`}
          key={col.key}
          onDragOver={(e) => {
            e.preventDefault()
            if (overKey !== col.key) setOverKey(col.key)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setOverKey((k) => (k === col.key ? null : k))
          }}
          onDrop={(e) => {
            e.preventDefault()
            setOverKey(null)
            const id = e.dataTransfer.getData('text/plain')
            if (id) onMove(id, dimension, col.key)
          }}
        >
          <div className="kanban-col-header">
            <span>{col.label}</span>
            <span className="tag-count">{col.items.length}</span>
          </div>
          <div className="kanban-cards">
            {col.items.length === 0 ? (
              <p className="kanban-empty">—</p>
            ) : (
              col.items.map((item) => (
                <ContentCard key={item.id} item={item} onSelect={onSelect} compact draggable />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function MonthCalendar({ items, onSelect }) {
  const today = todayISO()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selected, setSelected] = useState(today)

  const byDate = useMemo(() => {
    const map = new Map()
    items.forEach((item) => {
      if (!item.publish_date) return
      if (!map.has(item.publish_date)) map.set(item.publish_date, [])
      map.get(item.publish_date).push(item)
    })
    return map
  }, [items])

  const { y, m } = cursor
  const firstWeekday = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)

  function shift(delta) {
    setCursor((prev) => {
      const next = new Date(prev.y, prev.m + delta, 1)
      return { y: next.getFullYear(), m: next.getMonth() }
    })
  }

  function goToday() {
    const d = new Date()
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
    setSelected(today)
  }

  const selectedItems = selected ? byDate.get(selected) || [] : []

  return (
    <div className="card">
      <div className="cal-header">
        <button type="button" className="row-action-btn" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <h2 className="cal-title">
          {MONTHS[m]} {y}
        </h2>
        <button type="button" className="row-action-btn" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
        <button type="button" className="row-action-btn cal-today-btn" onClick={goToday}>
          Today
        </button>
      </div>

      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="cal-weekday">
            {wd}
          </div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} className="cal-cell cal-cell-blank" />

          const iso = `${y}-${pad(m + 1)}-${pad(day)}`
          const dayItems = byDate.get(iso) || []
          const isToday = iso === today
          const isSelected = iso === selected

          return (
            <button
              type="button"
              key={iso}
              className={`cal-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => setSelected(iso)}
            >
              <span className="cal-daynum">{day}</span>
              {dayItems.length > 0 && (
                <span className="cal-dots">
                  {dayItems.slice(0, 4).map((item, i) => (
                    <span key={item.id ?? i} className={`cal-dot stage-${item.stage}`} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-selected">
        <div className="project-scope-header">
          <h3>
            {selected
              ? new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Pick a day'}
          </h3>
          <span className="list-row-sub">{selectedItems.length}</span>
        </div>
        {selectedItems.length === 0 ? (
          <p className="empty-text">Nothing scheduled this day.</p>
        ) : (
          <div className="cal-selected-list">
            {selectedItems.map((item) => (
              <ContentCard key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MonthList({ items, onSelect }) {
  const { months, unscheduled } = useMemo(() => {
    const scheduled = items.filter((item) => item.publish_date)
    const undated = items.filter((item) => !item.publish_date)

    const byMonth = new Map()
    scheduled
      .slice()
      .sort((a, b) => a.publish_date.localeCompare(b.publish_date))
      .forEach((item) => {
        const key = item.publish_date.slice(0, 7)
        if (!byMonth.has(key)) byMonth.set(key, [])
        byMonth.get(key).push(item)
      })

    return {
      months: Array.from(byMonth.entries()).map(([key, list]) => {
        const [yr, mo] = key.split('-')
        return { key, label: `${MONTHS[Number(mo) - 1]} ${yr}`, items: list }
      }),
      unscheduled: undated,
    }
  }, [items])

  return (
    <>
      {months.map((month) => (
        <div className="card" key={month.key}>
          <div className="project-scope-header">
            <h2>{month.label}</h2>
            <span className="list-row-sub">{month.items.length}</span>
          </div>
          <div className="cal-selected-list">
            {month.items.map((item) => (
              <ContentCard key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}

      {unscheduled.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Unscheduled</h2>
            <span className="list-row-sub">{unscheduled.length}</span>
          </div>
          <div className="cal-selected-list">
            {unscheduled.map((item) => (
              <ContentCard key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Calendar() {
  const { brand } = useBrand()

  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved && VIEWS.some((v) => v.key === saved)) return saved
    } catch {
      // ignore
    }
    return 'calendar'
  })

  function chooseView(next) {
    setView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('brand', brand)
      .order('publish_date', { nullsFirst: false })
      .order('created_at')

    if (error) {
      console.log('Failed to load content for calendar', error.message)
      setItems([])
      setLoaded(true)
      return
    }

    setItems(data)
    setLoaded(true)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  const updateItem = useCallback(
    async (id, patch) => {
      let finalPatch = patch
      if ('stage' in patch) {
        const current = items.find((item) => item.id === id)
        finalPatch = { ...patch }
        if (patch.stage === 'posted') {
          finalPatch.posted_at = (current && current.posted_at) || new Date().toISOString()
        } else {
          finalPatch.posted_at = null
        }
      }

      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...finalPatch } : item)))
      setSelectedItem((prev) => (prev && prev.id === id ? { ...prev, ...finalPatch } : prev))

      const { error } = await supabase.from('content_items').update(finalPatch).eq('id', id)
      if (error) {
        console.log('Failed to update content item', error.message)
        load()
      }
    },
    [items, load],
  )

  function handleMove(id, dimension, columnKey) {
    if (dimension === 'stage') {
      updateItem(id, { stage: columnKey })
    } else if (dimension === 'format') {
      updateItem(id, { format: columnKey === 'unset' ? null : columnKey })
    }
  }

  const typeColumns = useMemo(() => {
    return FORMATS.map((f) => ({
      key: f.value,
      label: f.label,
      items: items.filter((item) => (item.format || 'other') === f.value),
    }))
      .filter((col) => col.items.length > 0)
      .concat([{ key: 'unset', label: 'No format', items: items.filter((item) => !item.format) }])
  }, [items])

  const statusColumns = useMemo(() => {
    return STAGES.map((s) => ({
      key: s.value,
      label: s.label,
      items: items.filter((item) => item.stage === s.value),
    }))
  }, [items])

  const boardView = view === 'type' || view === 'status'

  return (
    <div className="brand-tab-body">
      <div className="card brand-help-card">
        <span className="brand-kit-eyebrow">Content calendar</span>
        <p className="brand-help-text">
          A brand-filtered view of your content pipeline. Tap any card to see the details
          {boardView ? ', or drag a card to another column to move it' : ''}. Add and edit
          items in the{' '}
          <Link to="/content" className="project-link">
            Content module
          </Link>
          .
        </p>
      </div>

      <nav className="view-tabs cal-view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`view-tab${view === v.key ? ' active' : ''}`}
            onClick={() => chooseView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {loaded && items.length === 0 ? (
        <div className="card">
          <EmptyState icon="🗓️" title="Nothing here for this brand yet">
            Capture ideas in the Content module and set a publish date — they’ll show up across
            all these views.
          </EmptyState>
        </div>
      ) : (
        <>
          {view === 'calendar' && <MonthCalendar items={items} onSelect={setSelectedItem} />}
          {view === 'list' && <MonthList items={items} onSelect={setSelectedItem} />}
          {view === 'type' && (
            <Kanban
              columns={typeColumns.filter((c) => c.items.length > 0 || c.key === 'unset')}
              dimension="format"
              onSelect={setSelectedItem}
              onMove={handleMove}
            />
          )}
          {view === 'status' && (
            <Kanban
              columns={statusColumns}
              dimension="stage"
              onSelect={setSelectedItem}
              onMove={handleMove}
            />
          )}
        </>
      )}

      <ContentDetail item={selectedItem} onClose={() => setSelectedItem(null)} onUpdate={updateItem} />
    </div>
  )
}

export default Calendar
