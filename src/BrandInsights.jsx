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
const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]))

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

const PLATFORM_LABEL = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  blog: 'Blog',
  email: 'Email',
  other: 'Other',
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function daysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const offsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10)
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

function BrandInsights() {
  const { brand } = useBrand()

  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('brand', brand)

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
    const pipeline = items.filter(
      (item) => item.stage !== 'posted' && item.stage !== 'parked',
    )
    const cutoff = daysAgoISO(30)
    const postedRecent = posted.filter((item) => {
      const when = item.posted_at ? item.posted_at.slice(0, 10) : item.publish_date
      return when && when >= cutoff
    })

    return {
      total: items.length,
      posted: posted.length,
      pipeline: pipeline.length,
      recent: postedRecent.length,
    }
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

  return (
    <div className="brand-tab-body">
      <div className="card brand-help-card">
        <span className="brand-kit-eyebrow">Insights</span>
        <p className="brand-help-text">
          A gentle read on your content — no pressure, just noticing. Pulled from your{' '}
          <Link to="/content" className="project-link">
            Content
          </Link>{' '}
          for this brand.
        </p>
      </div>

      {loaded && items.length === 0 ? (
        <div className="card">
          <EmptyState icon="📊" title="No insights yet">
            Once you have content captured and posted, this fills in with what you’ve made and
            where it lives.
          </EmptyState>
        </div>
      ) : (
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
      )}
    </div>
  )
}

export default BrandInsights
