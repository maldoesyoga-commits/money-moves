import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { formatHours } from './lib/freelance'
import { todayISO } from './lib/taskDates'
import { periodRange, shiftPeriod, periodLabel, isCurrentPeriod } from './lib/planPeriods'
import { isSpendingTxn } from './lib/spending'

async function safeSelect(table, build) {
  const { data, error } = await build(supabase.from(table).select('*'))

  if (error) {
    console.log(`Review skipped ${table}`, error.message)
    return []
  }

  return data || []
}

function Review() {
  const [anchor, setAnchor] = useState(todayISO())
  const [data, setData] = useState(null)

  const { start, end } = useMemo(() => periodRange('week', anchor), [anchor])

  const load = useCallback(async () => {
    setData(null)

    const [done, logged, posted, invoices, journal, plans, txns, clients, projects, upcoming, publishing] =
      await Promise.all([
        safeSelect('tasks', (q) => q.eq('status', 'done').gte('done_at', `${start}T00:00:00`).lte('done_at', `${end}T23:59:59`)),
        safeSelect('time_entries', (q) => q.gte('entry_date', start).lte('entry_date', end)),
        safeSelect('content_items', (q) => q.eq('stage', 'posted').gte('posted_at', start).lte('posted_at', end)),
        safeSelect('invoices', (q) => q.gte('issue_date', start).lte('issue_date', end)),
        safeSelect('journal_entries', (q) => q.gte('entry_date', start).lte('entry_date', end)),
        safeSelect('plan_entries', (q) => q.eq('horizon', 'week').gte('start_date', start).lte('start_date', end)),
        safeSelect('transactions', (q) => q.gte('txn_date', start).lte('txn_date', end)),
        safeSelect('clients', (q) => q),
        safeSelect('freelance_projects', (q) => q),
        safeSelect('tasks', (q) => q.neq('status', 'done').lte('due_date', shiftPeriod('week', anchor, 1))),
        safeSelect('content_items', (q) => q.neq('stage', 'posted').not('publish_date', 'is', null)),
      ])

    setData({ done, logged, posted, invoices, journal, plans, txns, clients, projects, upcoming, publishing })
  }, [start, end, anchor])

  useEffect(() => {
    load()
  }, [load])

  if (!data) return <p className="empty-text">Pulling the week together…</p>

  const minutes = data.logged.reduce((sum, entry) => sum + entry.minutes, 0)

  const value = data.logged.reduce((sum, entry) => {
    if (!entry.billable) return sum
    const project = data.projects.find((p) => p.id === entry.project_id)
    const rate = project?.rate || data.clients.find((c) => c.id === (entry.client_id || project?.client_id))?.rate
    return rate ? sum + (entry.minutes / 60) * Number(rate) : sum
  }, 0)

  const spent = data.txns.filter(isSpendingTxn).reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  const invoiced = data.invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0)
  const paid = data.invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

  const plansDone = data.plans.filter((entry) => entry.done).length

  // Next week's window, for the look-ahead.
  const next = periodRange('week', shiftPeriod('week', anchor, 1))
  const dueNext = data.upcoming.filter(
    (task) => task.due_date && task.due_date >= next.start && task.due_date <= next.end,
  )
  const publishNext = data.publishing.filter(
    (item) => item.publish_date >= next.start && item.publish_date <= next.end,
  )

  const stats = [
    { label: 'Tasks finished', value: data.done.length, to: '/tasks' },
    { label: 'Time logged', value: formatHours(minutes), sub: value > 0 ? formatMoney(value) : null, to: '/freelance/time' },
    { label: 'Posts shipped', value: data.posted.length, to: '/content' },
    { label: 'Invoiced', value: formatMoney(invoiced), sub: paid > 0 ? `${formatMoney(paid)} paid` : null, to: '/freelance/invoices' },
    { label: 'Spent', value: formatMoney(spent), to: '/money/transactions' },
    { label: 'Journal days', value: `${data.journal.length}/7`, to: '/notes/journal' },
  ]

  return (
    <section className="review-module">
      <div className="home-greeting">
        <h1>Weekly review</h1>
        <p className="list-row-sub">What actually happened, in one place.</p>
      </div>

      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod('week', anchor, -1))}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{periodLabel('week', anchor)}</span>
          {!isCurrentPeriod('week', anchor) && (
            <button type="button" className="period-today-link" onClick={() => setAnchor(todayISO())}>
              This week
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod('week', anchor, 1))}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <div className="review-grid">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className="review-stat">
            <span className="review-stat-value">{stat.value}</span>
            <span className="review-stat-label">{stat.label}</span>
            {stat.sub && <span className="review-stat-sub">{stat.sub}</span>}
          </Link>
        ))}
      </div>

      {data.plans.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h2>What you planned</h2>
            <span className="list-row-sub">
              {plansDone} of {data.plans.length} done
            </span>
          </div>
          <ul className="list">
            {data.plans.map((entry) => (
              <li key={entry.id} className={`list-row${entry.done ? ' task-done' : ''}`}>
                <span className="list-row-title task-title">{entry.title}</span>
                <span className="list-row-sub">{entry.done ? 'done' : 'not yet'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="project-scope-header">
          <h2>Finished</h2>
          <span className="list-row-sub">{data.done.length}</span>
        </div>
        {data.done.length === 0 ? (
          <p className="empty-text">Nothing ticked off this week.</p>
        ) : (
          <ul className="list">
            {data.done.map((task) => (
              <li key={task.id} className="list-row">
                <span className="list-row-title">{task.title}</span>
                <span className="list-row-sub">{(task.done_at || '').slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.posted.length > 0 && (
        <div className="card">
          <h2>Posted</h2>
          <ul className="list">
            {data.posted.map((item) => (
              <li key={item.id} className="list-row">
                <span className="list-row-title">{item.title}</span>
                <span className="list-row-sub">
                  {item.platform} · {item.posted_at}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Next week</h2>
        {dueNext.length === 0 && publishNext.length === 0 ? (
          <p className="empty-text">Nothing scheduled yet — worth ten minutes in Planning.</p>
        ) : (
          <ul className="list">
            {dueNext.map((task) => (
              <li key={task.id} className="list-row">
                <span className="list-row-title">{task.title}</span>
                <span className="list-row-sub">due {task.due_date}</span>
              </li>
            ))}
            {publishNext.map((item) => (
              <li key={item.id} className="list-row">
                <span className="list-row-title">{item.title}</span>
                <span className="list-row-sub">
                  publish {item.publish_date} · {item.stage}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Review
