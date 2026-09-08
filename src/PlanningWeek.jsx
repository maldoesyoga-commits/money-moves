import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO } from './lib/taskDates'
import { formatMoney } from './lib/format'
import { daysInRange } from './lib/planPeriods'
import { isoWeek, weeksInYear } from './lib/calendar'
import { getPeriodContaining, periodLabel } from './lib/period'
import { isSpendingTxn } from './lib/spending'
import { nextOccurrence } from './lib/recurrence'
import { startFocus } from './lib/focus'

// The week at a glance: seven days, everything dated in them, plus the
// week number and what's left of the month's budget.
function PlanningWeek({ start, end, onPickDay }) {
  const [tasks, setTasks] = useState([])
  const [content, setContent] = useState([])
  const [plans, setPlans] = useState([])
  const [invoices, setInvoices] = useState([])
  const [blocks, setBlocks] = useState([])
  const [projects, setProjects] = useState([])
  const [flProjects, setFlProjects] = useState([])
  const [clients, setClients] = useState([])
  const [milestones, setMilestones] = useState([])

  const [focus, setFocus] = useState(null)
  const [focusDraft, setFocusDraft] = useState('')

  const [money, setMoney] = useState(null)

  const load = useCallback(async () => {
    const [
      taskRes,
      contentRes,
      planRes,
      invoiceRes,
      blockRes,
      projectRes,
      flProjectRes,
      clientRes,
      milestoneRes,
    ] = await Promise.all([
      supabase.from('tasks').select('*').gte('due_date', start).lte('due_date', end),
      supabase.from('content_items').select('*').gte('publish_date', start).lte('publish_date', end),
      supabase.from('plan_entries').select('*').gte('start_date', start).lte('start_date', end),
      supabase.from('invoices').select('*').gte('due_date', start).lte('due_date', end),
      supabase.from('time_blocks').select('*').gte('block_date', start).lte('block_date', end),
      supabase.from('projects').select('*'),
      // The other project planner — freelance work lives in its own table.
      supabase
        .from('freelance_projects')
        .select('*')
        .gte('due_date', start)
        .lte('due_date', end),
      supabase.from('clients').select('id, name'),
      supabase
        .from('milestones')
        .select('*')
        .or(`and(achieved.eq.false,target_date.gte.${start},target_date.lte.${end}),and(achieved.eq.true,achieved_on.gte.${start},achieved_on.lte.${end})`),
    ])

    if (taskRes.error) report('Failed to load tasks', taskRes.error)
    else setTasks(taskRes.data || [])

    setContent(contentRes.error ? [] : contentRes.data || [])
    setInvoices(invoiceRes.error ? [] : invoiceRes.data || [])
    setBlocks(blockRes.error ? [] : blockRes.data || [])
    setProjects(projectRes.error ? [] : projectRes.data || [])
    setFlProjects(flProjectRes.error ? [] : flProjectRes.data || [])
    setClients(clientRes.error ? [] : clientRes.data || [])
    setMilestones(milestoneRes.error ? [] : milestoneRes.data || [])

    const planRows = planRes.error ? [] : planRes.data || []
    setPlans(planRows.filter((row) => row.horizon === 'day'))

    const weekFocus =
      planRows.find((row) => row.horizon === 'week' && row.entry_kind === 'intention') || null
    setFocus(weekFocus)
    setFocusDraft(weekFocus?.title || '')
  }, [start, end])

  // Budget for the statement period this week sits in, and what's left.
  const loadMoney = useCallback(async () => {
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('statement_day')
      .single()

    if (settingsError) {
      report('Failed to load settings', settingsError)
      return
    }

    const statementDay = Number(settings?.statement_day) || 1
    const period = getPeriodContaining(new Date(`${start}T12:00:00`), statementDay)

    const [budgetRes, txnRes] = await Promise.all([
      supabase.from('category_budgets').select('*').eq('period_start', period.startKey),
      supabase
        .from('transactions')
        .select('*')
        .gte('txn_date', period.startKey)
        .lte('txn_date', period.endKey),
    ])

    if (budgetRes.error || txnRes.error) return

    const budgeted = (budgetRes.data || []).reduce((sum, row) => sum + Number(row.amount), 0)
    const spentPeriod = (txnRes.data || [])
      .filter(isSpendingTxn)
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
    const spentWeek = (txnRes.data || [])
      .filter((txn) => isSpendingTxn(txn) && txn.txn_date >= start && txn.txn_date <= end)
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

    // Days left in the period, so "left per week" means something.
    const today = todayISO()
    const from = today > period.startKey ? today : period.startKey
    const daysLeft = Math.max(
      1,
      Math.round(
        (new Date(`${period.endKey}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000,
      ) + 1,
    )

    setMoney({
      period,
      statementDay,
      budgeted,
      spentPeriod,
      spentWeek,
      left: budgeted - spentPeriod,
      perWeekLeft: ((budgeted - spentPeriod) / daysLeft) * 7,
    })
  }, [start, end])

  useEffect(() => {
    load()
    loadMoney()
  }, [load, loadMoney])

  async function saveFocus() {
    const trimmed = focusDraft.trim()

    if (!trimmed) {
      if (!focus) return
      const { error } = await supabase.from('plan_entries').delete().eq('id', focus.id)
      if (error) {
        report('Failed to clear the week focus', error)
        return
      }
      setFocus(null)
      return
    }

    if (focus) {
      const { error } = await supabase
        .from('plan_entries')
        .update({ title: trimmed })
        .eq('id', focus.id)

      if (error) {
        report('Failed to save the week focus', error)
        return
      }

      setFocus({ ...focus, title: trimmed })
      return
    }

    const { data, error } = await supabase
      .from('plan_entries')
      .insert({
        horizon: 'week',
        start_date: start,
        end_date: end,
        title: trimmed,
        entry_kind: 'intention',
        sort_order: -1,
      })
      .select()
      .single()

    if (error) {
      report('Failed to save the week focus', error)
      return
    }

    setFocus(data)
  }

  async function toggleTask(task) {
    const done = task.status !== 'done'

    setTasks((prev) =>
      prev.map((row) =>
        row.id === task.id ? { ...row, status: done ? 'done' : 'todo' } : row,
      ),
    )

    const { error } = await supabase
      .from('tasks')
      .update({
        status: done ? 'done' : 'todo',
        done_at: done ? new Date().toISOString() : null,
      })
      .eq('id', task.id)

    if (error) {
      report('Failed to update task', error)
      load()
      return
    }

    if (done && task.repeat_every) {
      const { error: repeatError } = await supabase.from('tasks').insert(nextOccurrence(task))
      if (repeatError) report('Failed to create next occurrence', repeatError)
    }
  }

  const days = daysInRange(start, end)
  const today = todayISO()
  const { week, year } = isoWeek(start)
  const total = weeksInYear(year)

  const openTasks = tasks.filter((task) => task.status !== 'done')
  const doneCount = tasks.length - openTasks.length

  function projectName(id) {
    return projects.find((project) => project.id === id)?.name
  }

  function clientName(id) {
    return clients.find((client) => client.id === id)?.name
  }

  // Both planners feed the week. Personal and work projects carry a start and
  // a target date; freelance projects carry a client deadline.
  function milestonesOn(day) {
    const own = projects.flatMap((project) => {
      const rows = []
      if (project.start_date === day) {
        rows.push({ id: `${project.id}-start`, project, kind: 'starts' })
      }
      if (project.target_date === day) {
        rows.push({ id: `${project.id}-target`, project, kind: 'target' })
      }
      return rows
    })

    const freelance = flProjects
      .filter((project) => project.due_date === day)
      .map((project) => ({ id: `fl-${project.id}`, project, kind: 'freelance' }))

    return [...own, ...freelance]
  }

  return (
    <>
      <div className="card week-header">
        <div className="project-scope-header">
          <h2>
            Week {week}
            <span className="list-row-sub"> of {total}</span>
          </h2>
          <span className="list-row-sub">
            {doneCount} of {tasks.length} tasks done
          </span>
        </div>

        <input
          type="text"
          className="quick-add-title intention-input"
          value={focusDraft}
          onChange={(e) => setFocusDraft(e.target.value)}
          onBlur={saveFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="What this week is for…"
        />
      </div>

      {money && money.budgeted > 0 && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Budget left</h2>
            <Link to="/money/budgets" className="row-action-btn">
              Budget
            </Link>
          </div>

          <div className="review-grid budget-week-grid">
            <div className="review-stat">
              <span className={`review-stat-value${money.left < 0 ? ' over' : ''}`}>
                {formatMoney(money.left)}
              </span>
              <span className="review-stat-label">Left this period</span>
              <span className="review-stat-sub">
                {periodLabel(money.period, money.statementDay)}
              </span>
            </div>
            <div className="review-stat">
              <span className="review-stat-value">{formatMoney(money.spentWeek)}</span>
              <span className="review-stat-label">Spent this week</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-value">
                {formatMoney(Math.max(0, money.perWeekLeft))}
              </span>
              <span className="review-stat-label">A week from here</span>
              <span className="review-stat-sub">to stay inside it</span>
            </div>
          </div>

          <div className="progress-track">
            <div
              className={`progress-fill${money.spentPeriod > money.budgeted ? ' progress-fill-over' : ''}`}
              style={{
                width: `${Math.min(100, (money.spentPeriod / money.budgeted) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="week-grid-days">
        {days.map((day) => {
          const dayTasks = tasks.filter((task) => task.due_date === day)
          const dayContent = content.filter((item) => item.publish_date === day)
          const dayPlans = plans.filter((plan) => plan.start_date === day)
          const dayInvoices = invoices.filter((invoice) => invoice.due_date === day)
          const dayBlocks = blocks.filter((block) => block.block_date === day)
          const dayMilestones = milestonesOn(day)
          const dayMarkers = milestones.filter((row) =>
            row.achieved ? row.achieved_on === day : row.target_date === day,
          )
          const intention = dayPlans.find((plan) => plan.entry_kind === 'intention')
          const priorities = dayPlans.filter((plan) => plan.entry_kind === 'priority')

          const empty =
            dayTasks.length === 0 &&
            dayContent.length === 0 &&
            dayPlans.length === 0 &&
            dayInvoices.length === 0 &&
            dayMilestones.length === 0 &&
            dayMarkers.length === 0

          const label = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })

          return (
            <div className={`card week-day${day === today ? ' week-day-today' : ''}`} key={day}>
              <div className="project-scope-header">
                <h3>{label}</h3>
                <div className="week-day-actions">
                  {dayBlocks.length > 0 && (
                    <span className="list-row-sub">{dayBlocks.length} blocks</span>
                  )}
                  <button type="button" className="row-action-btn" onClick={() => onPickDay(day)}>
                    Open
                  </button>
                </div>
              </div>

              {intention && <p className="week-intention">{intention.title}</p>}

              {empty ? (
                <p className="empty-text">Clear.</p>
              ) : (
                <ul className="list week-list">
                  {priorities.map((row) => (
                    <li key={row.id} className={`list-row${row.done ? ' task-done' : ''}`}>
                      <div className="list-row-main">
                        <span className="list-row-title task-title">
                          <span className="week-tag priority">priority</span>
                          {row.title}
                        </span>
                      </div>
                    </li>
                  ))}

                  {dayTasks.map((task) => (
                    <li
                      key={task.id}
                      className={`list-row task-row${task.status === 'done' ? ' task-done' : ''}`}
                    >
                      <div className="task-row-body">
                        <button
                          type="button"
                          className={`task-check${task.status === 'done' ? ' checked' : ''}`}
                          onClick={() => toggleTask(task)}
                          aria-label="Toggle"
                        >
                          {task.status === 'done' ? '✓' : ''}
                        </button>
                        <div className="list-row-main task-main">
                          <span className="list-row-title task-title">{task.title}</span>
                          {task.project_id && (
                            <span className="list-row-sub">{projectName(task.project_id)}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => startFocus({ label: task.title, taskId: task.id })}
                        >
                          Focus
                        </button>
                      </div>
                    </li>
                  ))}

                  {dayMilestones.map(({ id, project, kind }) => (
                    <li key={id} className="list-row">
                      <div className="list-row-main">
                        <Link
                          to={
                            kind === 'freelance'
                              ? '/freelance/projects'
                              : `/tasks/projects/${project.id}`
                          }
                          className="list-row-title project-link"
                        >
                          <span className="week-tag priority">
                            {kind === 'starts' ? 'starts' : 'due'}
                          </span>
                          {project.name}
                        </Link>
                        <span className="list-row-sub">
                          {kind === 'freelance'
                            ? [clientName(project.client_id), project.status]
                                .filter(Boolean)
                                .join(' · ')
                            : kind === 'starts'
                              ? 'project starts'
                              : 'project target date'}
                        </span>
                      </div>
                    </li>
                  ))}

                  {dayMarkers.map((row) => (
                    <li key={row.id} className={`list-row${row.achieved ? ' task-done' : ''}`}>
                      <div className="list-row-main">
                        <Link to="/milestones" className="list-row-title project-link">
                          <span className="week-tag priority">
                            {row.achieved ? 'reached' : 'milestone'}
                          </span>
                          {row.title}
                        </Link>
                      </div>
                    </li>
                  ))}

                  {dayContent.map((item) => (
                    <li key={item.id} className="list-row">
                      <div className="list-row-main">
                        <span className="list-row-title">
                          <span className={`week-tag brand-tag brand-${item.brand}`}>
                            {item.platform}
                          </span>
                          {item.title}
                        </span>
                        <span className="list-row-sub">{item.stage}</span>
                      </div>
                    </li>
                  ))}

                  {dayInvoices.map((invoice) => (
                    <li key={invoice.id} className="list-row">
                      <div className="list-row-main">
                        <Link to="/freelance/invoices" className="list-row-title project-link">
                          <span className="week-tag invoice">invoice</span>
                          {invoice.number || 'Invoice'} due
                        </Link>
                        <span className="list-row-sub">
                          {formatMoney(invoice.amount)} · {invoice.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default PlanningWeek
