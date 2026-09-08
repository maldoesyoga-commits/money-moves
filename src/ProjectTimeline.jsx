import { useMemo, useState } from 'react'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'

const MODES = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'calendar', label: 'Calendar' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ICON = { marker: '◆', task: '✓', content: '▶' }

function toISO(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthKey(iso) {
  return iso.slice(0, 7)
}

function monthLabel(key) {
  return new Date(`${key}-01T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMonth(key, delta) {
  const date = new Date(`${key}-01T12:00:00`)
  date.setMonth(date.getMonth() + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Monday-first grid covering the whole month, padded out to full weeks.
function monthDays(key) {
  const first = new Date(`${key}-01T12:00:00`)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    return {
      iso: toISO(date),
      dayOfMonth: date.getDate(),
      inMonth: monthKey(toISO(date)) === key,
    }
  })
}

// Everything on this project that has a date, on one spine: the project's own
// start and target, tasks by due date, content by publish date.
function buildEvents(project, tasks, content) {
  const events = []

  if (project.start_date) {
    events.push({
      id: 'project-start',
      date: project.start_date,
      kind: 'marker',
      label: 'Project starts',
      sub: 'start date',
    })
  }

  if (project.target_date) {
    events.push({
      id: 'project-target',
      date: project.target_date,
      kind: 'marker',
      label: 'Target date',
      sub: 'the date you are aiming at',
    })
  }

  tasks.forEach((task) => {
    if (!task.due_date) return
    events.push({
      id: `task-${task.id}`,
      date: task.due_date,
      kind: 'task',
      label: task.title,
      sub: task.status === 'done' ? 'done' : task.status === 'doing' ? 'in progress' : 'to do',
      done: task.status === 'done',
    })
  })

  content.forEach((item) => {
    if (!item.publish_date) return
    events.push({
      id: `content-${item.id}`,
      date: item.publish_date,
      kind: 'content',
      label: item.title,
      sub: [item.brand?.toUpperCase(), item.stage].filter(Boolean).join(' · '),
      done: item.stage === 'posted',
    })
  })

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function ProjectTimeline({ project, tasks, content }) {
  const [mode, setMode] = useState('timeline')
  const today = todayISO()

  const events = useMemo(() => buildEvents(project, tasks, content), [project, tasks, content])

  const [month, setMonth] = useState(() => monthKey(events[0]?.date || today))
  const [picked, setPicked] = useState(null)

  if (events.length === 0) {
    return (
      <div className="card">
        <p className="empty-text">
          Nothing dated yet. Give the project a start or target date, put due dates on
          its tasks, or schedule content against it — anything with a date shows up here.
        </p>
      </div>
    )
  }

  const grouped = events.reduce((acc, event) => {
    const key = monthKey(event.date)
    acc[key] = acc[key] || []
    acc[key].push(event)
    return acc
  }, {})

  const byDate = events.reduce((acc, event) => {
    acc[event.date] = acc[event.date] || []
    acc[event.date].push(event)
    return acc
  }, {})

  return (
    <>
      <nav className="segmented-nav view-mode-nav">
        {MODES.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`segmented-tab${mode === option.key ? ' active' : ''}`}
            onClick={() => setMode(option.key)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {mode === 'timeline' && (
        <div className="card">
          <p className="list-row-sub">
            ◆ project dates · ✓ tasks · ▶ content — everything with a date, in order.
          </p>

          {Object.entries(grouped).map(([key, rows]) => (
            <div className="goal-progress-block" key={key}>
              <div className="budget-row-header">
                <span className="list-row-title">{monthLabel(key)}</span>
                <span className="list-row-sub">{rows.length}</span>
              </div>

              <ul className="list">
                {rows.map((event) => {
                  const late = !event.done && event.kind !== 'marker' && isOverdue(event.date)

                  return (
                    <li key={event.id} className={`list-row${event.done ? ' task-done' : ''}`}>
                      <div className="task-row-body">
                        <span className="calendar-daynum" aria-hidden="true">
                          {ICON[event.kind]}
                        </span>
                        <div className="list-row-main task-main">
                          <span className="list-row-title task-title">{event.label}</span>
                          <span className="list-row-sub task-meta">
                            <span className={late ? 'task-overdue' : undefined}>
                              {formatDueDate(event.date)}
                            </span>
                            <span>{event.sub}</span>
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {mode === 'calendar' && (
        <div className="card calendar">
          <div className="period-selector">
            <button
              type="button"
              className="icon-button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="period-selector-label">
              <span>{monthLabel(month)}</span>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="calendar-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className="calendar-weekday">
                {day}
              </div>
            ))}

            {monthDays(month).map((day) => {
              const items = byDate[day.iso] || []
              const open = items.filter((event) => !event.done && event.kind !== 'marker')
              const allDone = items.length > 0 && open.length === 0
              const late = open.length > 0 && day.iso < today

              return (
                <button
                  key={day.iso}
                  type="button"
                  className={[
                    'calendar-day',
                    day.inMonth ? '' : 'outside',
                    day.iso === today ? 'is-today' : '',
                    picked === day.iso ? 'is-picked' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setPicked(picked === day.iso ? null : day.iso)}
                >
                  <span className="calendar-daynum">{day.dayOfMonth}</span>
                  {items.length > 0 && (
                    <span className={`calendar-count${allDone ? ' done' : late ? ' late' : ''}`}>
                      {allDone ? '✓' : items.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {picked && (
            <div className="calendar-day-list">
              <div className="project-scope-header">
                <h3>{formatDueDate(picked)}</h3>
                <span className="list-row-sub">{picked}</span>
              </div>

              {(byDate[picked] || []).length === 0 ? (
                <p className="empty-text">Nothing on this day.</p>
              ) : (
                <ul className="list">
                  {(byDate[picked] || []).map((event) => (
                    <li key={event.id} className={`list-row${event.done ? ' task-done' : ''}`}>
                      <div className="list-row-main">
                        <span className="list-row-title">
                          {ICON[event.kind]} {event.label}
                        </span>
                        <span className="list-row-sub">{event.sub}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default ProjectTimeline
