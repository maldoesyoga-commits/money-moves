import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { formatHours } from './lib/freelance'
import { todayISO } from './lib/taskDates'
import {
  periodRange,
  shiftPeriod,
  periodLabel,
  isCurrentPeriod,
  daysInRange,
} from './lib/planPeriods'
import { weekNumberFor, plannedFor, executionScore, TARGET_SCORE } from './lib/twelveWeek'
import { isSpendingTxn } from './lib/spending'

async function safeSelect(table, build) {
  const { data, error } = await build(supabase.from(table).select('*'))

  if (error) {
    console.log(`Review skipped ${table}`, error.message)
    return []
  }

  return data || []
}

// A date lands in the period if its YYYY-MM-DD part is inside [start, end].
function inRange(value, start, end) {
  if (!value) return false
  const day = value.slice(0, 10)
  return day >= start && day <= end
}

// A cookie-jar moment belongs to the period if it happened then (moment_on),
// or, when undated, if it was captured then (created_at).
function momentInRange(row, start, end) {
  if (row.moment_on) return inRange(row.moment_on, start, end)
  return inRange(row.created_at, start, end)
}

function Review() {
  const [horizon, setHorizon] = useState('week')
  const [anchor, setAnchor] = useState(todayISO())
  const [data, setData] = useState(null)

  const { start, end } = useMemo(() => periodRange(horizon, anchor), [horizon, anchor])
  const periodDays = useMemo(() => daysInRange(start, end).length, [start, end])

  const isWeek = horizon === 'week'
  const thisLabel = isWeek ? 'This week' : 'This month'
  const nextLabel = isWeek ? 'Next week' : 'Next month'

  const load = useCallback(async () => {
    setData(null)

    const [
      done,
      logged,
      posted,
      invoices,
      journal,
      plans,
      txns,
      funds,
      habits,
      habitLogs,
      clients,
      projects,
      upcoming,
      publishing,
      jar,
      cycles,
    ] = await Promise.all([
      safeSelect('tasks', (q) =>
        q.eq('status', 'done').gte('done_at', `${start}T00:00:00`).lte('done_at', `${end}T23:59:59`),
      ),
      safeSelect('time_entries', (q) => q.gte('entry_date', start).lte('entry_date', end)),
      safeSelect('content_items', (q) =>
        q.eq('stage', 'posted').gte('posted_at', start).lte('posted_at', end),
      ),
      safeSelect('invoices', (q) => q.gte('issue_date', start).lte('issue_date', end)),
      safeSelect('journal_entries', (q) => q.gte('entry_date', start).lte('entry_date', end)),
      safeSelect('plan_entries', (q) =>
        q.eq('horizon', horizon).gte('start_date', start).lte('start_date', end),
      ),
      safeSelect('transactions', (q) => q.gte('txn_date', start).lte('txn_date', end)),
      safeSelect('fund_entries', (q) => q.gte('entry_date', start).lte('entry_date', end)),
      safeSelect('habits', (q) => q),
      safeSelect('habit_logs', (q) => q.gte('log_date', start).lte('log_date', end)),
      safeSelect('clients', (q) => q),
      safeSelect('freelance_projects', (q) => q),
      safeSelect('tasks', (q) => q.neq('status', 'done')),
      safeSelect('content_items', (q) => q.neq('stage', 'posted').not('publish_date', 'is', null)),
      safeSelect('cookie_jar', (q) => q),
      safeSelect('twy_cycles', (q) => q.in('status', ['planning', 'active'])),
    ])

    // Execution only means something on a single cycle-week, so it's a
    // week-view figure. Pull the tactic logs just for that case.
    const cycle = cycles[0] || null
    let tactics = []
    let tacticLogs = []

    if (isWeek && cycle) {
      const goals = await safeSelect('twy_goals', (q) => q.eq('cycle_id', cycle.id))
      if (goals.length > 0) {
        tactics = await safeSelect('twy_tactics', (q) =>
          q.in('goal_id', goals.map((goal) => goal.id)),
        )
        tacticLogs = await safeSelect('twy_tactic_logs', (q) => q)
      }
    }

    setData({
      done,
      logged,
      posted,
      invoices,
      journal,
      plans,
      txns,
      funds,
      habits,
      habitLogs,
      clients,
      projects,
      upcoming,
      publishing,
      jar,
      cycle,
      tactics,
      tacticLogs,
    })
  }, [start, end, horizon, isWeek])

  useEffect(() => {
    load()
  }, [load])

  if (!data) {
    return <p className="empty-text">Pulling the {isWeek ? 'week' : 'month'} together…</p>
  }

  // --- work ------------------------------------------------------------------
  const minutes = data.logged.reduce((sum, entry) => sum + entry.minutes, 0)

  const value = data.logged.reduce((sum, entry) => {
    if (!entry.billable) return sum
    const project = data.projects.find((p) => p.id === entry.project_id)
    const rate =
      project?.rate ||
      data.clients.find((c) => c.id === (entry.client_id || project?.client_id))?.rate
    return rate ? sum + (entry.minutes / 60) * Number(rate) : sum
  }, 0)

  // --- money -----------------------------------------------------------------
  const moneyIn = data.txns
    .filter((txn) => txn.direction === 'in')
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  const moneyOut = data.txns
    .filter((txn) => txn.direction === 'out')
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  const afterExpenses = moneyIn - moneyOut
  const spent = data.txns.filter(isSpendingTxn).reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

  const intoSavings = data.funds.reduce(
    (sum, entry) => sum + (entry.direction === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0)),
    0,
  )

  const invoiced = data.invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0)
  const paid = data.invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

  // --- health & movement -----------------------------------------------------
  const activeHabits = data.habits.filter((habit) => habit.active)
  const habitRows = activeHabits
    .map((habit) => ({
      habit,
      hits: data.habitLogs.filter((log) => log.habit_id === habit.id).length,
    }))
    .sort((a, b) => b.hits - a.hits)

  const habitHits = habitRows.reduce((sum, row) => sum + row.hits, 0)
  const habitPossible = activeHabits.length * periodDays
  const habitPct = habitPossible > 0 ? Math.round((habitHits / habitPossible) * 100) : null

  const movement = habitRows.find((row) => /mov(e|ing|ement)|workout|exercise|gym|training/i.test(row.habit.name))

  // --- goals execution (week view only) --------------------------------------
  const cycleWeek = isWeek && data.cycle ? weekNumberFor(data.cycle.start_date, start) : null
  const dueThisWeek =
    cycleWeek && cycleWeek > 0 ? data.tactics.filter((tactic) => plannedFor(tactic, cycleWeek) > 0) : []
  const execution =
    cycleWeek && cycleWeek > 0 ? executionScore(dueThisWeek, data.tacticLogs, cycleWeek) : null

  // --- planned ---------------------------------------------------------------
  const plansDone = data.plans.filter((entry) => entry.done).length

  // --- wins ------------------------------------------------------------------
  const wins = data.jar.filter((row) => momentInRange(row, start, end))

  // --- look ahead ------------------------------------------------------------
  const next = periodRange(horizon, shiftPeriod(horizon, anchor, 1))
  const dueNext = data.upcoming.filter(
    (task) => task.due_date && task.due_date >= next.start && task.due_date <= next.end,
  )
  const publishNext = data.publishing.filter(
    (item) => item.publish_date >= next.start && item.publish_date <= next.end,
  )

  // --- stat tiles ------------------------------------------------------------
  const stats = [
    { label: 'Tasks finished', value: data.done.length, to: '/tasks' },
    {
      label: 'Time logged',
      value: formatHours(minutes),
      sub: value > 0 ? formatMoney(value) : null,
      to: '/freelance/time',
    },
    { label: 'Posts shipped', value: data.posted.length, to: '/content' },
    { label: 'Spent', value: formatMoney(spent), to: '/money/transactions' },
    {
      label: 'Income after expenses',
      value: formatMoney(afterExpenses),
      to: '/money/insights',
    },
  ]

  if (movement) {
    stats.push({ label: 'Movement', value: `${movement.hits}/${periodDays}`, to: '/daily' })
  }
  if (habitPct !== null) {
    stats.push({ label: 'Habits kept', value: `${habitPct}%`, to: '/daily' })
  }
  if (execution !== null) {
    stats.push({
      label: 'Execution',
      value: `${execution}%`,
      sub: `${TARGET_SCORE}% is the line`,
      to: '/goals',
      good: execution >= TARGET_SCORE,
    })
  }
  stats.push({ label: 'Journal days', value: `${data.journal.length}/${periodDays}`, to: '/notes/journal' })

  return (
    <section className="review-module">
      <div className="home-greeting">
        <h1>{isWeek ? 'Weekly review' : 'Monthly review'}</h1>
        <p className="list-row-sub">What actually happened, in one place.</p>
      </div>

      <div className="field-row review-horizon">
        <button
          type="button"
          className={isWeek ? undefined : 'btn-secondary'}
          onClick={() => setHorizon('week')}
        >
          Week
        </button>
        <button
          type="button"
          className={isWeek ? 'btn-secondary' : undefined}
          onClick={() => setHorizon('month')}
        >
          Month
        </button>
      </div>

      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod(horizon, anchor, -1))}
          aria-label={isWeek ? 'Previous week' : 'Previous month'}
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{periodLabel(horizon, anchor)}</span>
          {!isCurrentPeriod(horizon, anchor) && (
            <button type="button" className="period-today-link" onClick={() => setAnchor(todayISO())}>
              {thisLabel}
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod(horizon, anchor, 1))}
          aria-label={isWeek ? 'Next week' : 'Next month'}
        >
          ›
        </button>
      </div>

      <div className="review-grid">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className="review-stat">
            <span className={`review-stat-value${stat.good ? ' score-good' : ''}`}>{stat.value}</span>
            <span className="review-stat-label">{stat.label}</span>
            {stat.sub && <span className="review-stat-sub">{stat.sub}</span>}
          </Link>
        ))}
      </div>

      {/* --- Money ------------------------------------------------------------ */}
      <div className="card">
        <div className="project-scope-header">
          <h2>Money</h2>
          <Link to="/money" className="row-action-btn">
            Money Moves
          </Link>
        </div>
        <ul className="list">
          <li className="list-row">
            <span className="list-row-title">Money in</span>
            <span className="amount-in">+{formatMoney(moneyIn)}</span>
          </li>
          <li className="list-row">
            <span className="list-row-title">Money out</span>
            <span className="amount-out">-{formatMoney(moneyOut)}</span>
          </li>
          <li className="list-row">
            <span className="list-row-title">Income after expenses</span>
            <span className={afterExpenses >= 0 ? 'amount-in' : 'amount-out'}>
              {formatMoney(afterExpenses)}
            </span>
          </li>
          <li className="list-row">
            <span className="list-row-title">Into savings</span>
            <span className={intoSavings >= 0 ? 'amount-in' : 'amount-out'}>
              {intoSavings >= 0 ? '+' : ''}
              {formatMoney(intoSavings)}
            </span>
          </li>
          {invoiced > 0 && (
            <li className="list-row">
              <span className="list-row-title">Invoiced</span>
              <span className="list-row-sub">
                {formatMoney(invoiced)}
                {paid > 0 ? ` · ${formatMoney(paid)} paid` : ''}
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* --- Health & movement ----------------------------------------------- */}
      {activeHabits.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Health &amp; movement</h2>
            <Link to="/daily" className="row-action-btn">
              Daily
            </Link>
          </div>
          <div className="meter-stack">
            {habitRows.map(({ habit, hits }) => {
              const pct = periodDays > 0 ? Math.min(100, Math.round((hits / periodDays) * 100)) : 0
              return (
                <div className="meter-block" key={habit.id}>
                  <div className="budget-row-header">
                    <span className="list-row-title">
                      {habit.icon ? `${habit.icon} ` : ''}
                      {habit.name}
                    </span>
                    <span className="list-row-sub">
                      {hits} of {periodDays} days
                    </span>
                  </div>
                  <div className="meter-track">
                    <div className="meter-fill" style={{ width: `${pct}%`, background: 'var(--chart-1)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* --- Content ---------------------------------------------------------- */}
      {data.posted.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Posted</h2>
            <span className="list-row-sub">{data.posted.length}</span>
          </div>
          <ul className="list">
            {data.posted.map((item) => (
              <li key={item.id} className="list-row">
                <span className="list-row-title">{item.title}</span>
                <span className="list-row-sub">
                  {item.platform} · {(item.posted_at || '').slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Work: finished --------------------------------------------------- */}
      <div className="card">
        <div className="project-scope-header">
          <h2>Finished</h2>
          <span className="list-row-sub">{data.done.length}</span>
        </div>
        {data.done.length === 0 ? (
          <p className="empty-text">Nothing ticked off {isWeek ? 'this week' : 'this month'}.</p>
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

      {/* --- Wins ------------------------------------------------------------- */}
      {wins.length > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Wins</h2>
            <Link to="/cookie-jar" className="row-action-btn">
              Cookie jar
            </Link>
          </div>
          <ul className="list">
            {wins.map((row) => (
              <li key={row.id} className="list-row">
                <span className="list-row-title">{row.title}</span>
                <span className="list-row-sub">{(row.moment_on || row.created_at || '').slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- What you planned ------------------------------------------------- */}
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

      {/* --- Look ahead ------------------------------------------------------- */}
      <div className="card">
        <h2>{nextLabel}</h2>
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
