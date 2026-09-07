import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import TaskList from './TaskList'
import { report } from './lib/report'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

function ProjectDetail() {
  const { projectId } = useParams()

  const [project, setProject] = useState(null)
  const [counts, setCounts] = useState({ open: 0, done: 0, overdue: 0 })
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  const loadProject = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) {
      report('Failed to load project', error)
      return
    }

    setProject(data)
    setNotesDraft(data.notes || '')
  }, [projectId])

  const loadCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('status, due_date')
      .eq('project_id', projectId)

    if (error) {
      report('Failed to load project task counts', error)
      return
    }

    const today = new Date().toISOString().slice(0, 10)
    const open = data.filter((task) => task.status !== 'done').length
    const done = data.filter((task) => task.status === 'done').length
    const overdue = data.filter(
      (task) => task.status !== 'done' && task.due_date && task.due_date < today,
    ).length

    setCounts({ open, done, overdue })
  }, [projectId])

  useEffect(() => {
    loadProject()
    loadCounts()
  }, [loadProject, loadCounts])

  // Notes save on a short pause rather than on every keystroke.
  useEffect(() => {
    if (!project || notesDraft === (project.notes || '')) return

    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from('projects')
        .update({ notes: notesDraft || null })
        .eq('id', projectId)

      if (error) {
        report('Failed to save project notes', error)
        return
      }

      setProject((prev) => ({ ...prev, notes: notesDraft }))
      setSavedAt(new Date())
    }, 700)

    return () => clearTimeout(timer)
  }, [notesDraft, project, projectId])

  async function updateProject(patch) {
    setProject((prev) => ({ ...prev, ...patch }))

    const { error } = await supabase.from('projects').update(patch).eq('id', projectId)

    if (error) {
      report('Failed to update project', error)
      loadProject()
    }
  }

  if (!project) return <p className="empty-text">Loading…</p>

  const total = counts.open + counts.done
  const pct = total === 0 ? 0 : Math.round((counts.done / total) * 100)

  return (
    <>
      <div className="card project-detail-head">
        <div className="project-scope-header">
          <div className="project-title-row">
            <span
              className="project-dot"
              style={{ background: project.color || 'var(--text-soft)' }}
            />
            <h2>{project.name}</h2>
          </div>
          <Link to="/tasks/projects" className="row-action-btn">
            All projects
          </Link>
        </div>

        {project.description && <p className="list-row-sub">{project.description}</p>}

        <div className="progress-wrap">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="list-row-sub">
            {counts.done} of {total} done ({pct}%)
            {counts.overdue > 0 && (
              <span className="task-overdue"> · {counts.overdue} overdue</span>
            )}
          </p>
        </div>

        <div className="task-controls">
          <select
            className="inline-select"
            value={project.status}
            onChange={(e) => updateProject({ status: e.target.value })}
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="row-action-btn"
            onClick={() => setNotesOpen((open) => !open)}
          >
            {notesOpen ? 'Hide notes' : project.notes ? 'Notes ✓' : 'Add notes'}
          </button>
        </div>

        {notesOpen && (
          <div className="project-notes">
            <textarea
              rows="6"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Everything about this project that isn't a task — decisions, links, who said what."
            />
            <p className="list-row-sub">
              {savedAt
                ? `Saved ${savedAt.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : 'Saves as you type.'}
            </p>
          </div>
        )}
      </div>

      <TaskList onChanged={loadCounts} />
    </>
  )
}

export default ProjectDetail
