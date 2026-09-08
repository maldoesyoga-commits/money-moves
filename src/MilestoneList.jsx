import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'
import { report } from './lib/report'

// The embedded milestone list. Dropped into a project page or a goal, it reads
// and writes the one milestones table — nothing is copied, so whatever is added
// here shows up in the log and the planner too.
function MilestoneList({ projectId, goalId, freelanceProjectId, hint }) {
  const [milestones, setMilestones] = useState([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  const column = projectId
    ? 'project_id'
    : goalId
      ? 'goal_id'
      : freelanceProjectId
        ? 'freelance_project_id'
        : null

  const value = projectId || goalId || freelanceProjectId || null

  const load = useCallback(async () => {
    if (!column) return

    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq(column, value)
      .order('achieved')
      .order('target_date', { nullsFirst: false })
      .order('sort_order')

    if (error) {
      report('Failed to load milestones', error)
      return
    }

    setMilestones(data)
  }, [column, value])

  useEffect(() => {
    load()
  }, [load])

  async function addMilestone(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed || !column) return

    const { error } = await supabase.from('milestones').insert({
      title: trimmed,
      target_date: date || null,
      [column]: value,
      sort_order: milestones.length,
    })

    if (error) {
      report('Failed to add milestone', error)
      return
    }

    setTitle('')
    setDate('')
    load()
  }

  async function toggle(milestone) {
    const patch = milestone.achieved
      ? { achieved: false, achieved_on: null }
      : { achieved: true, achieved_on: todayISO() }

    setMilestones((prev) =>
      prev.map((row) => (row.id === milestone.id ? { ...row, ...patch } : row)),
    )

    const { error } = await supabase.from('milestones').update(patch).eq('id', milestone.id)

    if (error) {
      report('Failed to update milestone', error)
      load()
    }
  }

  async function remove(id) {
    setMilestones((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('milestones').delete().eq('id', id)

    if (error) {
      report('Failed to delete milestone', error)
      load()
    }
  }

  const hit = milestones.filter((row) => row.achieved).length

  return (
    <div className="card">
      <div className="project-scope-header">
        <h2>Milestones</h2>
        <Link to="/milestones" className="row-action-btn">
          All milestones
        </Link>
      </div>

      <p className="list-row-sub">
        {hint ||
          'The moments worth marking. They all land in one log you can look back on.'}
        {milestones.length > 0 && ` · ${hit} of ${milestones.length} reached`}
      </p>

      {milestones.length === 0 ? (
        <p className="empty-text">None yet.</p>
      ) : (
        <ul className="list">
          {milestones.map((milestone) => {
            const late = !milestone.achieved && isOverdue(milestone.target_date)

            return (
              <li
                key={milestone.id}
                className={`list-row task-row${milestone.achieved ? ' task-done' : ''}`}
              >
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`task-check${milestone.achieved ? ' checked' : ''}`}
                    onClick={() => toggle(milestone)}
                    aria-label={milestone.achieved ? 'Not yet' : 'Mark reached'}
                  >
                    {milestone.achieved ? '✓' : ''}
                  </button>
                  <div className="list-row-main task-main">
                    <span className="list-row-title task-title">{milestone.title}</span>
                    <span className="list-row-sub task-meta">
                      {milestone.achieved ? (
                        <span>reached {formatDueDate(milestone.achieved_on)}</span>
                      ) : milestone.target_date ? (
                        <span className={late ? 'task-overdue' : undefined}>
                          {formatDueDate(milestone.target_date)}
                        </span>
                      ) : (
                        <span>no date</span>
                      )}
                      {milestone.detail && <span>{milestone.detail}</span>}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => remove(milestone.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form className="field-row" onSubmit={addMilestone}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="milestone — a moment, not a task"
        />
        <input
          type="date"
          className="inline-select"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Add
        </button>
      </form>
    </div>
  )
}

export default MilestoneList
