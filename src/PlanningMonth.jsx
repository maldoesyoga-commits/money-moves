import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO } from './lib/taskDates'
import { monthGrid, WEEKDAYS } from './lib/calendar'
import BudgetPanel from './BudgetPanel'

// Month view: everything dated, on one grid. Tasks due, content to publish,
// day plans you've written, and invoices falling due.
function PlanningMonth({ anchor, start, end, onPickDay }) {
  const [tasks, setTasks] = useState([])
  const [content, setContent] = useState([])
  const [plans, setPlans] = useState([])
  const [invoices, setInvoices] = useState([])
  const [picked, setPicked] = useState(null)

  const load = useCallback(async () => {
    const [taskRes, contentRes, planRes, invoiceRes] = await Promise.all([
      supabase.from('tasks').select('*').gte('due_date', start).lte('due_date', end),
      supabase.from('content_items').select('*').gte('publish_date', start).lte('publish_date', end),
      supabase.from('plan_entries').select('*').eq('horizon', 'day').gte('start_date', start).lte('start_date', end),
      supabase.from('invoices').select('*').gte('due_date', start).lte('due_date', end),
    ])

    if (taskRes.error) report('Failed to load tasks', taskRes.error)
    else setTasks(taskRes.data || [])

    setContent(contentRes.error ? [] : contentRes.data || [])
    setPlans(planRes.error ? [] : planRes.data || [])
    setInvoices(invoiceRes.error ? [] : invoiceRes.data || [])
  }, [start, end])

  useEffect(() => {
    load()
  }, [load])

  const weeks = monthGrid(anchor)
  const today = todayISO()

  function itemsFor(iso) {
    return {
      tasks: tasks.filter((task) => task.due_date === iso),
      content: content.filter((item) => item.publish_date === iso),
      plans: plans.filter((plan) => plan.start_date === iso),
      invoices: invoices.filter((invoice) => invoice.due_date === iso),
    }
  }

  const day = picked ? itemsFor(picked) : null

  return (
    <>
      <BudgetPanel anchor={anchor} />

      <div className="card">
      <div className="calendar-grid month-grid">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="calendar-weekday">
            {weekday}
          </div>
        ))}

        {weeks.flat().map((cell) => {
          const items = itemsFor(cell.iso)
          const openTasks = items.tasks.filter((task) => task.status !== 'done')
          const late = openTasks.length > 0 && cell.iso < today

          return (
            <button
              key={cell.iso}
              type="button"
              className={[
                'calendar-day month-day',
                cell.inMonth ? '' : 'outside',
                cell.iso === today ? 'is-today' : '',
                picked === cell.iso ? 'is-picked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setPicked(picked === cell.iso ? null : cell.iso)}
            >
              <span className="calendar-daynum">{cell.dayOfMonth}</span>

              <span className="month-marks">
                {openTasks.length > 0 && (
                  <span className={`month-mark tasks${late ? ' late' : ''}`}>
                    {openTasks.length}
                  </span>
                )}
                {items.content.length > 0 && <span className="month-mark content" />}
                {items.invoices.length > 0 && <span className="month-mark invoice" />}
                {items.plans.length > 0 && <span className="month-mark plan" />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="month-key">
        <span>
          <span className="month-mark tasks">n</span> tasks due
        </span>
        <span>
          <span className="month-mark content" /> content
        </span>
        <span>
          <span className="month-mark invoice" /> invoice
        </span>
        <span>
          <span className="month-mark plan" /> day plan
        </span>
      </div>

      {picked && (
        <div className="calendar-day-list">
          <div className="project-scope-header">
            <h3>{picked}</h3>
            <button type="button" className="row-action-btn" onClick={() => onPickDay(picked)}>
              Open this day
            </button>
          </div>

          {day.tasks.length === 0 &&
          day.content.length === 0 &&
          day.plans.length === 0 &&
          day.invoices.length === 0 ? (
            <p className="empty-text">Nothing on this day.</p>
          ) : (
            <ul className="list">
              {day.plans.map((plan) => (
                <li key={plan.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{plan.title}</span>
                    <span className="list-row-sub">
                      {plan.is_priority ? 'priority' : 'day plan'}
                    </span>
                  </div>
                </li>
              ))}
              {day.tasks.map((task) => (
                <li key={task.id} className={`list-row${task.status === 'done' ? ' task-done' : ''}`}>
                  <div className="list-row-main">
                    <span className="list-row-title task-title">{task.title}</span>
                    <span className="list-row-sub">task</span>
                  </div>
                </li>
              ))}
              {day.content.map((item) => (
                <li key={item.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{item.title}</span>
                    <span className="list-row-sub">
                      {item.platform} · {item.stage}
                    </span>
                  </div>
                </li>
              ))}
              {day.invoices.map((invoice) => (
                <li key={invoice.id} className="list-row">
                  <div className="list-row-main">
                    <Link to="/freelance/invoices" className="list-row-title project-link">
                      {invoice.number || 'Invoice'} due
                    </Link>
                    <span className="list-row-sub">{invoice.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </>
  )
}

export default PlanningMonth
