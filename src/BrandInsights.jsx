import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import { todayISO } from './lib/taskDates'
import EmptyState from './EmptyState'

const STAGES = [
  { value: 'idea', label: 'Idea' },
  { value: 'scripted', label: 'Scripted' },
  { value: 'filmed', label: 'Filmed' },
  { value: 'edited', label: 'Edited' },
  { value: 'posted', label: 'Posted' },
  { value: 'parked', label: 'Parked' },
]

const FORMAT_LABEL = {
  reel: 'Reel',
  carousel: 'Carousel',
  story: 'Story',
  post: 'Post',
  video: 'Video',
  short: 'Short',
  newsletter: 'Newsletter',
  other: 'Other',
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'blog', label: 'Blog' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
]
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]))

const METRICS = [
  { key: 'reach', label: 'Reach' },
  { key: 'likes', label: 'Likes' },
  { key: 'saves', label: 'Saves' },
  { key: 'shares', label: 'Shares' },
  { key: 'comments', label: 'Comments' },
]

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const VIEWS = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'performance', label: 'Performance' },
]
const VIEW_STORAGE_KEY = 'homestead.insightsView'

function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const offsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10)
}

function toInt(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function formatNum(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function Breakdown({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="card">
      <div className="project-scope-header">
        <h2>{title}</h2>
        <span className="list-row-sub">{total}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-text">Nothing yet.</p>
      ) : (
        <div className="breakdown">
          {rows.map((row) => (
            <div className="breakdown-row" key={row.key}>
              <span className="breakdown-label">{row.label}</span>
              <span className="breakdown-track">
                <span
                  className="breakdown-fill"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </span>
              <span className="breakdown-count">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Pipeline() {
  const { brand } = useBrand()

  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('content_items').select('*').eq('brand', brand)
    if (error) {
      console.log('Failed to load content for insights', error.message)
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

  const stats = useMemo(() => {
    const posted = items.filter((item) => item.stage === 'posted')
    const pipeline = items.filter((item) => item.stage !== 'posted' && item.stage !== 'parked')
    const cutoff = daysAgoISO(30)
    const recent = posted.filter((item) => {
      const when = item.posted_at ? item.posted_at.slice(0, 10) : item.publish_date
      return when && when >= cutoff
    })
    return { total: items.length, posted: posted.length, pipeline: pipeline.length, recent: recent.length }
  }, [items])

  const stageRows = useMemo(
    () =>
      STAGES.map((s) => ({
        key: s.value,
        label: s.label,
        count: items.filter((item) => item.stage === s.value).length,
      })).filter((row) => row.count > 0),
    [items],
  )

  const formatRows = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => {
      const key = item.format || 'other'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: FORMAT_LABEL[key] || key, count }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const platformRows = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => {
      const key = item.platform || 'other'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: PLATFORM_LABEL[key] || key, count }))
      .sort((a, b) => b.count - a.count)
  }, [items])

  const monthRows = useMemo(() => {
    const now = new Date()
    const buckets = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        count: 0,
      })
    }
    const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]))
    items
      .filter((item) => item.stage === 'posted')
      .forEach((item) => {
        const when = item.posted_at ? item.posted_at.slice(0, 7) : (item.publish_date || '').slice(0, 7)
        if (when in index) buckets[index[when]].count += 1
      })
    return buckets
  }, [items])

  if (loaded && items.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="📊" title="No pipeline insights yet">
          Once you have content captured and posted, this fills in with what you’ve made and
          where it lives.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <div className="insight-tiles">
        <div className="insight-tile">
          <span className="insight-num">{stats.total}</span>
          <span className="insight-label">Total pieces</span>
        </div>
        <div className="insight-tile">
          <span className="insight-num">{stats.posted}</span>
          <span className="insight-label">Posted</span>
        </div>
        <div className="insight-tile">
          <span className="insight-num">{stats.pipeline}</span>
          <span className="insight-label">In the pipeline</span>
        </div>
        <div className="insight-tile">
          <span className="insight-num">{stats.recent}</span>
          <span className="insight-label">Posted · 30 days</span>
        </div>
      </div>

      <Breakdown title="Where it is in the pipeline" rows={stageRows} />
      <Breakdown title="By format" rows={formatRows} />
      <Breakdown title="By platform" rows={platformRows} />

      <div className="card">
        <div className="project-scope-header">
          <h2>Posted by month</h2>
          <span className="list-row-sub">last 6</span>
        </div>
        <div className="insight-months">
          {monthRows.map((month) => {
            const max = Math.max(1, ...monthRows.map((m) => m.count))
            return (
              <div className="insight-month" key={month.key}>
                <span className="insight-month-bar-wrap">
                  <span
                    className="insight-month-bar"
                    style={{ height: `${Math.round((month.count / max) * 100)}%` }}
                  />
                </span>
                <span className="insight-month-count">{month.count}</span>
                <span className="insight-month-label">{month.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function Performance() {
  const { brand } = useBrand()

  const [entries, setEntries] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [postedOn, setPostedOn] = useState(todayISO())
  const [sourceId, setSourceId] = useState('')
  const [sources, setSources] = useState([])

  const loadSources = useCallback(async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select('id, title, platform, publish_date, posted_at, link')
      .eq('brand', brand)
      .order('publish_date', { nullsFirst: false })
    if (!error && data) setSources(data)
  }, [brand])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  function pickSource(id) {
    setSourceId(id)
    if (!id) return
    const item = sources.find((s) => s.id === id)
    if (!item) return
    setTitle(item.title || '')
    if (item.platform) setPlatform(item.platform)
    const when = item.posted_at ? item.posted_at.slice(0, 10) : item.publish_date
    if (when) setPostedOn(when)
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('performance_log')
      .select('*')
      .eq('brand', brand)
      .order('posted_on', { nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.log('Failed to load performance log (run supabase/performance.sql?):', error.message)
      setEntries([])
      setLoaded(true)
      return
    }

    setEntries(data)
    setLoaded(true)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    const payload = { brand, title: trimmed, platform, sort_order: entries.length }
    if (postedOn) payload.posted_on = postedOn
    if (sourceId) {
      payload.content_item_id = sourceId
      const item = sources.find((s) => s.id === sourceId)
      if (item && item.link) payload.link = item.link
    }

    const { error } = await supabase.from('performance_log').insert(payload)
    if (error) {
      console.log('Failed to add performance entry', error.message)
      return
    }
    setTitle('')
    setSourceId('')
    load()
  }

  function updateLocal(id, patch) {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('performance_log').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save performance entry', error.message)
      load()
    }
  }

  async function deleteEntry(id) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
    const { error } = await supabase.from('performance_log').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete performance entry', error.message)
      load()
    }
  }

  const summary = useMemo(() => {
    function avg(key) {
      const vals = entries.map((e) => e[key]).filter((v) => v !== null && v !== undefined)
      if (vals.length === 0) return null
      return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length)
    }
    const withSaves = entries.filter((e) => e.saves !== null && e.saves !== undefined)
    const bestSaves = withSaves.length
      ? withSaves.reduce((best, e) => (e.saves > best.saves ? e : best))
      : null
    return {
      count: entries.length,
      avgReach: avg('reach'),
      avgSaves: avg('saves'),
      bestSaves,
    }
  }, [entries])

  return (
    <>
      {entries.length > 0 && (
        <div className="insight-tiles">
          <div className="insight-tile">
            <span className="insight-num">{summary.count}</span>
            <span className="insight-label">Logged posts</span>
          </div>
          <div className="insight-tile">
            <span className="insight-num">{formatNum(summary.avgReach)}</span>
            <span className="insight-label">Avg reach</span>
          </div>
          <div className="insight-tile">
            <span className="insight-num">{formatNum(summary.avgSaves)}</span>
            <span className="insight-label">Avg saves</span>
          </div>
          <div className="insight-tile">
            <span className="insight-num">{summary.bestSaves ? formatNum(summary.bestSaves.saves) : '—'}</span>
            <span className="insight-label">
              {summary.bestSaves ? `Most saved · ${summary.bestSaves.title}` : 'Most saved'}
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          {sources.length > 0 && (
            <select
              className="perf-source-select"
              value={sourceId}
              onChange={(e) => pickSource(e.target.value)}
            >
              <option value="">Link a post from Content (optional)…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            className="quick-add-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title — then tap Edit to add the numbers"
          />
          <div className="field-row">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} />
            <button type="submit">Log post</button>
          </div>
        </form>
      </div>

      {loaded && entries.length === 0 ? (
        <div className="card">
          <EmptyState icon="📈" title="No posts logged yet">
            Log a post above, then drop in its reach, likes, saves, shares, and comments. No
            pressure — track what’s useful to you.
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="project-scope-header">
            <h2>Posts</h2>
            <span className="list-row-sub">{entries.length}</span>
          </div>
          <ul className="list">
            {entries.map((entry) => {
              const open = expandedId === entry.id
              const chips = METRICS.filter(
                (m) => entry[m.key] !== null && entry[m.key] !== undefined,
              )

              return (
                <li key={entry.id} className="list-row project-row">
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title">
                        {entry.link ? (
                          <a href={entry.link} target="_blank" rel="noreferrer" className="project-link">
                            {entry.title}
                          </a>
                        ) : (
                          entry.title
                        )}
                      </span>
                      <span className="list-row-sub task-meta">
                        {entry.posted_on && <span>{formatDate(entry.posted_on)}</span>}
                        {entry.platform && <span>{PLATFORM_LABEL[entry.platform] || entry.platform}</span>}
                        {entry.content_item_id && <span className="priority-pill">↳ Content</span>}
                      </span>
                      {chips.length > 0 && (
                        <span className="metric-chips">
                          {chips.map((m) => (
                            <span key={m.key} className="metric-chip">
                              <strong>{formatNum(entry[m.key])}</strong> {m.label.toLowerCase()}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setExpandedId(open ? null : entry.id)}
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
                          value={entry.title}
                          onChange={(e) => updateLocal(entry.id, { title: e.target.value })}
                          onBlur={(e) => persist(entry.id, { title: e.target.value.trim() || 'Untitled' })}
                        />
                        <select
                          className="inline-select"
                          value={entry.platform || 'instagram'}
                          onChange={(e) => persist(entry.id, { platform: e.target.value })}
                        >
                          {PLATFORMS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className="inline-select"
                          value={entry.posted_on || ''}
                          onChange={(e) => persist(entry.id, { posted_on: e.target.value || null })}
                        />
                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => deleteEntry(entry.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <div className="perf-fields">
                        {METRICS.map((m) => (
                          <div className="perf-field" key={m.key}>
                            <label htmlFor={`${entry.id}-${m.key}`}>{m.label}</label>
                            <input
                              id={`${entry.id}-${m.key}`}
                              type="number"
                              min="0"
                              value={entry[m.key] ?? ''}
                              onChange={(e) =>
                                updateLocal(entry.id, {
                                  [m.key]: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              onBlur={(e) => persist(entry.id, { [m.key]: toInt(e.target.value) })}
                            />
                          </div>
                        ))}
                      </div>

                      <input
                        type="url"
                        value={entry.link || ''}
                        placeholder="link to the post (optional)"
                        onChange={(e) => updateLocal(entry.id, { link: e.target.value })}
                        onBlur={(e) => persist(entry.id, { link: e.target.value.trim() || null })}
                      />
                      <textarea
                        rows="2"
                        value={entry.notes || ''}
                        placeholder="what worked, what you noticed…"
                        onChange={(e) => updateLocal(entry.id, { notes: e.target.value })}
                        onBlur={(e) => persist(entry.id, { notes: e.target.value || null })}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}

function BrandInsights() {
  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved && VIEWS.some((v) => v.key === saved)) return saved
    } catch {
      // ignore
    }
    return 'pipeline'
  })

  function chooseView(next) {
    setView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return (
    <div className="brand-tab-body">
      <div className="card brand-help-card">
        <span className="brand-kit-eyebrow">Insights</span>
        <p className="brand-help-text">
          A gentle read on your content — no pressure, just noticing.{' '}
          <strong>Pipeline</strong> pulls from your{' '}
          <Link to="/content" className="project-link">
            Content
          </Link>
          ; <strong>Performance</strong> is where you log real numbers.
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

      {view === 'pipeline' ? <Pipeline /> : <Performance />}
    </div>
  )
}

export default BrandInsights
