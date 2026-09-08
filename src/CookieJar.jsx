import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { todayISO } from './lib/taskDates'
import { report } from './lib/report'

const KINDS = [
  { value: 'win', label: 'Win', icon: '🏆' },
  { value: 'joy', label: 'Joy', icon: '✨' },
  { value: 'proud', label: 'Proud of myself', icon: '💛' },
  { value: 'kindness', label: 'Kindness', icon: '🤝' },
  { value: 'growth', label: 'Growth', icon: '🌱' },
  { value: 'other', label: 'Other', icon: '🍪' },
]

const KIND = Object.fromEntries(KINDS.map((kind) => [kind.value, kind]))

function yearOf(row) {
  return (row.moment_on || row.created_at || '').slice(0, 4) || 'Undated'
}

function niceDate(iso) {
  if (!iso) return 'no date'
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// The jar. Not a tracker — there is nothing to complete here, and nothing
// ever becomes overdue. The one thing it does that a list doesn't is let you
// reach in and pull one out when you need reminding.
function CookieJar() {
  const [moments, setMoments] = useState([])
  const [kindFilter, setKindFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [pulled, setPulled] = useState(null)
  const [openId, setOpenId] = useState(null)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [kind, setKind] = useState('win')
  const [why, setWhy] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('cookie_jar')
      .select('*')
      .order('moment_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      report('Failed to open the cookie jar', error)
      return
    }

    setMoments(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addMoment(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const { error } = await supabase.from('cookie_jar').insert({
      title: trimmed,
      moment_on: date || null,
      kind,
      why: why.trim() || null,
    })

    if (error) {
      report('Failed to add the moment', error)
      return
    }

    setTitle('')
    setWhy('')
    setDate(todayISO())
    load()
  }

  async function updateMoment(id, patch) {
    setMoments((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('cookie_jar').update(patch).eq('id', id)

    if (error) {
      report('Failed to update the moment', error)
      load()
    }
  }

  async function remove(id) {
    setMoments((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('cookie_jar').delete().eq('id', id)

    if (error) {
      report('Failed to remove the moment', error)
      load()
    }
  }

  // Favourites get a heavier weight — the ones you starred are the ones most
  // worth landing on when you're reaching in for a reason.
  function reachIn() {
    if (moments.length === 0) return

    const pool = moments.flatMap((row) => (row.favourite ? [row, row, row] : [row]))
    const picked = pool[Math.floor(Math.random() * pool.length)]

    setPulled(picked.id === pulled?.id && moments.length > 1 ? reachAgain(picked) : picked)
  }

  function reachAgain(avoid) {
    const others = moments.filter((row) => row.id !== avoid.id)
    return others[Math.floor(Math.random() * others.length)]
  }

  const visible = moments.filter((row) => {
    if (kindFilter !== 'all' && row.kind !== kindFilter) return false
    if (search) {
      const haystack = [row.title, row.detail, row.why].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  })

  const groups = visible.reduce((acc, row) => {
    const key = yearOf(row)
    acc[key] = acc[key] || []
    acc[key].push(row)
    return acc
  }, {})

  const years = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1))
  const thisYear = moments.filter(
    (row) => yearOf(row) === String(new Date().getFullYear()),
  ).length

  return (
    <section className="cookie-jar-module">
      <div className="home-greeting">
        <h1>🍪 Cookie Jar</h1>
        <p className="list-row-sub">
          Moments worth keeping. Reach in when you need reminding what you&apos;re
          capable of.
        </p>
      </div>

      <div className="review-grid">
        <div className="review-stat">
          <span className="review-stat-value">{moments.length}</span>
          <span className="review-stat-label">In the jar</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{thisYear}</span>
          <span className="review-stat-label">This year</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">
            {moments.filter((row) => row.favourite).length}
          </span>
          <span className="review-stat-label">Starred</span>
        </div>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Reach in</h2>
          <button type="button" onClick={reachIn} disabled={moments.length === 0}>
            Pull one out
          </button>
        </div>

        {pulled ? (
          <div className="goal-progress-block">
            <p className="week-intention">
              {KIND[pulled.kind]?.icon} {pulled.title}
            </p>
            <p className="list-row-sub">{niceDate(pulled.moment_on)}</p>
            {pulled.why && <p className="list-row-sub">{pulled.why}</p>}
          </div>
        ) : (
          <p className="list-row-sub">
            {moments.length === 0
              ? 'Put something in first.'
              : 'One moment, at random. Starred ones come up more often.'}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Add a moment</h2>
        <form onSubmit={addMoment}>
          <div className="field-row">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="what happened"
            />
            <input
              type="date"
              className="inline-select"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <select
              className="inline-select"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            <button type="submit">Add</button>
          </div>
          <textarea
            rows="2"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="why it mattered — this is the part you'll want to read back"
          />
        </form>
      </div>

      <div className="card">
        <div className="transaction-filter-bar">
          <input
            type="search"
            className="inline-select"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search the jar"
          />
          <label className="filter-toggle">
            Kind
            <select
              className="inline-select"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
            >
              <option value="all">All</option>
              {KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="🍪" title="The jar is empty">
            Anything that made you proud, happy, or that you just want to remember. No
            such thing as too small.
          </EmptyState>
        ) : (
          years.map((year) => (
            <div className="category-group-block" key={year}>
              <h3>{year}</h3>
              <ul className="list">
                {groups[year].map((row) => {
                  const open = openId === row.id

                  return (
                    <li key={row.id} className="list-row">
                      <div className="task-row-body">
                        <button
                          type="button"
                          className={`star-button${row.favourite ? ' on' : ''}`}
                          onClick={() => updateMoment(row.id, { favourite: !row.favourite })}
                          aria-label={row.favourite ? 'Unstar' : 'Star'}
                        >
                          {row.favourite ? '★' : '☆'}
                        </button>

                        <div className="list-row-main task-main">
                          <span className="list-row-title task-title">
                            {KIND[row.kind]?.icon} {row.title}
                          </span>
                          <span className="list-row-sub task-meta">
                            <span>{niceDate(row.moment_on)}</span>
                            {row.why && <span>{row.why}</span>}
                            {row.detail && <span>{row.detail}</span>}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => setOpenId(open ? null : row.id)}
                        >
                          {open ? 'Close' : 'Edit'}
                        </button>
                      </div>

                      {open && (
                        <div className="task-controls">
                          <input
                            type="text"
                            className="inline-select"
                            value={row.title}
                            onChange={(e) => updateMoment(row.id, { title: e.target.value })}
                          />
                          <input
                            type="date"
                            className="inline-select"
                            value={row.moment_on || ''}
                            onChange={(e) =>
                              updateMoment(row.id, { moment_on: e.target.value || null })
                            }
                          />
                          <select
                            className="inline-select"
                            value={row.kind}
                            onChange={(e) => updateMoment(row.id, { kind: e.target.value })}
                          >
                            {KINDS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="inline-select"
                            value={row.why || ''}
                            placeholder="why it mattered"
                            onChange={(e) =>
                              updateMoment(row.id, { why: e.target.value || null })
                            }
                          />
                          <input
                            type="url"
                            className="inline-select"
                            value={row.link || ''}
                            placeholder="link"
                            onChange={(e) =>
                              updateMoment(row.id, { link: e.target.value || null })
                            }
                          />
                          <button
                            type="button"
                            className="row-action-btn row-action-btn-danger"
                            onClick={() => remove(row.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default CookieJar
