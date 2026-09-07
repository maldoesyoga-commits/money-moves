import { useState } from 'react'
import { todayISO } from './lib/taskDates'
import { monthGrid, shiftMonth, monthLabel, WEEKDAYS } from './lib/calendar'

// Month view of tasks by due date. Tapping a day filters the list below it;
// the quick-add at the top of the module picks up the day you chose.
function TaskCalendar({ tasks, projectName, onToggle, onOpen, onPickDate }) {
  const [anchor, setAnchor] = useState(todayISO())
  const [picked, setPicked] = useState(null)

  const weeks = monthGrid(anchor)
  const today = todayISO()

  const byDate = {}
  tasks.forEach((task) => {
    if (!task.due_date) return
    byDate[task.due_date] = byDate[task.due_date] || []
    byDate[task.due_date].push(task)
  })

  const undated = tasks.filter((task) => !task.due_date && task.status !== 'done')
  const dayTasks = picked ? byDate[picked] || [] : []

  function choose(iso) {
    const next = picked === iso ? null : iso
    setPicked(next)
    onPickDate?.(next)
  }

  return (
    <div className="calendar">
      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftMonth(anchor, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{monthLabel(anchor)}</span>
          <button type="button" className="period-today-link" onClick={() => setAnchor(todayISO())}>
            This month
          </button>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftMonth(anchor, 1))}
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

        {weeks.flat().map((day) => {
          const items = byDate[day.iso] || []
          const open = items.filter((task) => task.status !== 'done')
          const allDone = items.length > 0 && open.length === 0
          const late = open.some(() => day.iso < today)

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
              onClick={() => choose(day.iso)}
            >
              <span className="calendar-daynum">{day.dayOfMonth}</span>
              {items.length > 0 && (
                <span
                  className={`calendar-count${allDone ? ' done' : late ? ' late' : ''}`}
                >
                  {allDone ? '✓' : open.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {picked && (
        <div className="calendar-day-list">
          <div className="project-scope-header">
            <h3>{picked}</h3>
            <span className="list-row-sub">{dayTasks.length} due</span>
          </div>

          {dayTasks.length === 0 ? (
            <p className="empty-text">
              Nothing due. Anything you add now lands on this day.
            </p>
          ) : (
            <ul className="list">
              {dayTasks.map((task) => {
                const done = task.status === 'done'

                return (
                  <li key={task.id} className={`list-row task-row${done ? ' task-done' : ''}`}>
                    <div className="task-row-body">
                      <button
                        type="button"
                        className={`task-check${done ? ' checked' : ''}`}
                        onClick={() => onToggle(task)}
                        aria-label={done ? 'Mark as not done' : 'Mark as done'}
                      >
                        {done ? '✓' : ''}
                      </button>
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">{task.title}</span>
                        {task.project_id && (
                          <span className="list-row-sub">{projectName(task.project_id)}</span>
                        )}
                      </div>
                      <button type="button" className="row-action-btn" onClick={() => onOpen(task)}>
                        Edit
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {undated.length > 0 && (
        <div className="calendar-day-list">
          <div className="project-scope-header">
            <h3>No date</h3>
            <span className="list-row-sub">{undated.length}</span>
          </div>
          <ul className="list">
            {undated.map((task) => (
              <li key={task.id} className="list-row task-row">
                <div className="task-row-body">
                  <button
                    type="button"
                    className="task-check"
                    onClick={() => onToggle(task)}
                    aria-label="Mark as done"
                  />
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{task.title}</span>
                  </div>
                  <button type="button" className="row-action-btn" onClick={() => onOpen(task)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default TaskCalendar
