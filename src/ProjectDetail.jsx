import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import TaskList from './TaskList'
import ProjectTimeline from './ProjectTimeline'
import MilestoneList from './MilestoneList'
import ProjectResources from './ProjectResources'
import EmptyState from './EmptyState'
import { todayISO, formatDueDate } from './lib/taskDates'
import { report } from './lib/report'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

const COLORS = ['#3f6b5c', '#b87333', '#4e6e8a', '#bf8f6b', '#6e7a75']

const BRANDS = [
  { value: 'cm', label: 'Creating Mal' },
  { value: 'hh', label: 'Hope Heals' },
  { value: 'om', label: 'Ollie & Me' },
  { value: 'other', label: 'Other' },
]

const NOTE_CATEGORIES = [
  { value: 'note', label: 'Note' },
  { value: 'idea', label: 'Idea' },
  { value: 'reference', label: 'Reference' },
  { value: 'someday', label: 'Someday' },
]

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
  { key: 'content', label: 'Content' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'resources', label: 'Resources' },
]

function ProjectDetail() {
  const { projectId } = useParams()

  const [project, setProject] = useState(null)
  const [tab, setTab] = useState('overview')

  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])
  const [looseNotes, setLooseNotes] = useState([])
  const [content, setContent] = useState([])
  const [looseContent, setLooseContent] = useState([])
  const [goals, setGoals] = useState([])

  const [notesDraft, setNotesDraft] = useState('')
  const [savedAt, setSavedAt] = useState(null)

  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteCategory, setNoteCategory] = useState('note')
  const [contentTitle, setContentTitle] = useState('')
  const [contentBrand, setContentBrand] = useState('cm')

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

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)

    if (error) {
      report('Failed to load project tasks', error)
      return
    }

    setTasks(data)
  }, [projectId])

  // Notes stay in the Notes database — the project page is a linked view of them.
  const loadNotes = useCallback(async () => {
    const [{ data: mine, error }, { data: loose }] = await Promise.all([
      supabase
        .from('notes')
        .select('*')
        .eq('project_id', projectId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('notes')
        .select('id, title, body')
        .is('project_id', null)
        .order('updated_at', { ascending: false })
        .limit(50),
    ])

    if (error) {
      report('Failed to load project notes', error)
      return
    }

    setNotes(mine || [])
    setLooseNotes(loose || [])
  }, [projectId])

  const loadContent = useCallback(async () => {
    const [{ data: mine, error }, { data: loose }] = await Promise.all([
      supabase
        .from('content_items')
        .select('*')
        .eq('project_id', projectId)
        .order('publish_date', { nullsFirst: false }),
      supabase
        .from('content_items')
        .select('id, title, brand, stage')
        .is('project_id', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (error) {
      report('Failed to load project content', error)
      return
    }

    setContent(mine || [])
    setLooseContent(loose || [])
  }, [projectId])

  const loadGoals = useCallback(async () => {
    const { data: cycles } = await supabase
      .from('twy_cycles')
      .select('id, title')
      .in('status', ['planning', 'active'])
      .order('start_date', { ascending: false })
      .limit(1)

    if (!cycles?.length) {
      setGoals([])
      return
    }

    const { data } = await supabase
      .from('twy_goals')
      .select('id, title, color, aim, lag_measure, lag_current, lag_target, lag_unit')
      .eq('cycle_id', cycles[0].id)
      .order('sort_order')

    setGoals(data || [])
  }, [])

  useEffect(() => {
    loadProject()
    loadTasks()
    loadNotes()
    loadContent()
    loadGoals()
  }, [loadProject, loadTasks, loadNotes, loadContent, loadGoals])

  // Working notes save on a short pause rather than on every keystroke.
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

  // --- notes -----------------------------------------------------------------

  async function createNote(e) {
    e.preventDefault()

    const trimmed = noteTitle.trim()
    if (!trimmed && !noteBody.trim()) return

    const { error } = await supabase.from('notes').insert({
      title: trimmed || null,
      body: noteBody,
      category: noteCategory,
      project_id: projectId,
    })

    if (error) {
      report('Failed to create note', error)
      return
    }

    setNoteTitle('')
    setNoteBody('')
    loadNotes()
  }

  async function setNoteProject(noteId, value) {
    const { error } = await supabase
      .from('notes')
      .update({ project_id: value })
      .eq('id', noteId)

    if (error) {
      report('Failed to link note', error)
    }

    loadNotes()
  }

  // --- content ---------------------------------------------------------------

  async function createContent(e) {
    e.preventDefault()

    const trimmed = contentTitle.trim()
    if (!trimmed) return

    const { error } = await supabase.from('content_items').insert({
      title: trimmed,
      brand: contentBrand,
      platform: 'instagram',
      project_id: projectId,
      sort_order: content.length,
    })

    if (error) {
      report('Failed to create content item', error)
      return
    }

    setContentTitle('')
    loadContent()
  }

  async function setContentProject(itemId, value) {
    const { error } = await supabase
      .from('content_items')
      .update({ project_id: value })
      .eq('id', itemId)

    if (error) {
      report('Failed to link content', error)
    }

    loadContent()
  }

  if (!project) return <p className="empty-text">Loading…</p>

  const today = todayISO()
  const done = tasks.filter((task) => task.status === 'done').length
  const open = tasks.length - done
  const overdue = tasks.filter(
    (task) => task.status !== 'done' && task.due_date && task.due_date < today,
  ).length
  const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
  const goal = goals.find((row) => row.id === project.twy_goal_id) || null

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

        {goal && (
          <p className="list-row-sub">
            🎯 <Link to="/goals/plan" className="project-link">{goal.title}</Link>
            {goal.aim ? ` — ${goal.aim}` : ''}
          </p>
        )}

        <div className="progress-wrap">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${pct}%`, background: project.color || undefined }}
            />
          </div>
          <p className="list-row-sub">
            {done} of {tasks.length} tasks done ({pct}%)
            {overdue > 0 && <span className="task-overdue"> · {overdue} overdue</span>}
            {project.target_date && ` · target ${formatDueDate(project.target_date)}`}
          </p>
        </div>
      </div>

      <nav className="segmented-nav">
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`segmented-tab${tab === option.key ? ' active' : ''}`}
            onClick={() => setTab(option.key)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className="card">
            <h2>Details</h2>

            <div className="task-controls">
              <input
                type="text"
                className="inline-select"
                value={project.name}
                onChange={(e) => updateProject({ name: e.target.value })}
                placeholder="project name"
              />
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
              {goals.length > 0 && (
                <select
                  className="inline-select"
                  value={project.twy_goal_id || ''}
                  onChange={(e) => updateProject({ twy_goal_id: e.target.value || null })}
                >
                  <option value="">No goal</option>
                  {goals.map((row) => (
                    <option key={row.id} value={row.id}>
                      🎯 {row.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <input
              type="text"
              value={project.description || ''}
              onChange={(e) => updateProject({ description: e.target.value || null })}
              placeholder="one line — what this project actually is"
            />

            <div className="task-controls">
              <label className="filter-toggle">
                Starts
                <input
                  type="date"
                  className="inline-select"
                  value={project.start_date || ''}
                  onChange={(e) => updateProject({ start_date: e.target.value || null })}
                />
              </label>
              <label className="filter-toggle">
                Target
                <input
                  type="date"
                  className="inline-select"
                  value={project.target_date || ''}
                  onChange={(e) => updateProject({ target_date: e.target.value || null })}
                />
              </label>
            </div>

            <div className="color-picker-row">
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={`color-swatch${project.color === swatch ? ' selected' : ''}`}
                  style={{ background: swatch }}
                  onClick={() => updateProject({ color: swatch })}
                  aria-label={`Colour ${swatch}`}
                />
              ))}
            </div>
          </div>

          <div className="review-grid">
            <div className="review-stat">
              <span className="review-stat-value">{open}</span>
              <span className="review-stat-label">Open tasks</span>
              {overdue > 0 && <span className="review-stat-sub">{overdue} overdue</span>}
            </div>
            <div className="review-stat">
              <span className="review-stat-value">{notes.length}</span>
              <span className="review-stat-label">Notes</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-value">{content.length}</span>
              <span className="review-stat-label">Content</span>
            </div>
            <div className="review-stat">
              <span className="review-stat-value">{pct}%</span>
              <span className="review-stat-label">Complete</span>
            </div>
          </div>

          <MilestoneList
            projectId={projectId}
            hint="The moments this project is aiming at — not the tasks that get you there."
          />

          <div className="card">
            <h2>Working notes</h2>
            <p className="list-row-sub">
              The scratchpad that lives on the project itself — decisions, links, who
              said what. Anything you&apos;d want to find from the Notes page instead
              belongs under the Notes tab.
            </p>
            <textarea
              rows="8"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Everything about this project that isn't a task."
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
        </>
      )}

      {tab === 'tasks' && (
        <TaskList
          onChanged={() => {
            loadTasks()
          }}
        />
      )}

      {tab === 'notes' && (
        <>
          <div className="card">
            <div className="project-scope-header">
              <h2>Notes</h2>
              <Link to="/notes" className="row-action-btn">
                All notes
              </Link>
            </div>
            <p className="list-row-sub">
              These live in the Notes database — this is a linked view. Unlinking leaves
              the note where it is.
            </p>

            {notes.length === 0 ? (
              <EmptyState icon="📓" title="No notes on this project">
                Write one below, or pull an existing loose note in. Either way it stays
                searchable from the Notes page.
              </EmptyState>
            ) : (
              <ul className="list">
                {notes.map((note) => (
                  <li key={note.id} className="list-row">
                    <div className="task-row-body">
                      <div className="list-row-main task-main">
                        <Link to="/notes" className="list-row-title project-link">
                          {note.pinned ? '📌 ' : ''}
                          {note.title || 'Untitled note'}
                        </Link>
                        <span className="list-row-sub">
                          {note.category}
                          {note.body ? ` — ${note.body.slice(0, 90)}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => setNoteProject(note.id, null)}
                      >
                        Unlink
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {looseNotes.length > 0 && (
              <div className="task-controls">
                <select
                  className="inline-select"
                  value=""
                  onChange={(e) => e.target.value && setNoteProject(e.target.value, projectId)}
                >
                  <option value="">link an existing note…</option>
                  {looseNotes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.title || note.body?.slice(0, 40) || 'Untitled note'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="card">
            <h2>New note</h2>
            <form onSubmit={createNote}>
              <div className="field-row">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="title"
                />
                <select
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                >
                  {NOTE_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows="5"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="…"
              />
              <button type="submit">Save note</button>
            </form>
          </div>
        </>
      )}

      {tab === 'content' && (
        <>
          <div className="card">
            <div className="project-scope-header">
              <h2>Content</h2>
              <Link to="/content" className="row-action-btn">
                All content
              </Link>
            </div>
            <p className="list-row-sub">
              Pieces tied to this project. The pipeline stage is still driven from the
              Content page.
            </p>

            {content.length === 0 ? (
              <EmptyState icon="🎬" title="No content on this project">
                Add a piece below, or link one that already exists.
              </EmptyState>
            ) : (
              <ul className="list">
                {content.map((item) => (
                  <li key={item.id} className="list-row project-row">
                    <div className="task-row-body">
                      <span className={`brand-dot brand-${item.brand}`} />
                      <div className="list-row-main task-main">
                        <Link to="/content" className="list-row-title project-link">
                          {item.title}
                        </Link>
                        <span className="list-row-sub task-meta">
                          <span>{item.stage}</span>
                          {item.platform && <span>{item.platform}</span>}
                          {item.publish_date && <span>{formatDueDate(item.publish_date)}</span>}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() => setContentProject(item.id, null)}
                      >
                        Unlink
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {looseContent.length > 0 && (
              <div className="task-controls">
                <select
                  className="inline-select"
                  value=""
                  onChange={(e) =>
                    e.target.value && setContentProject(e.target.value, projectId)
                  }
                >
                  <option value="">link existing content…</option>
                  {looseContent.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form className="field-row" onSubmit={createContent}>
              <input
                type="text"
                value={contentTitle}
                onChange={(e) => setContentTitle(e.target.value)}
                placeholder="new content idea for this project"
              />
              <select
                value={contentBrand}
                onChange={(e) => setContentBrand(e.target.value)}
              >
                {BRANDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary">
                Add
              </button>
            </form>
          </div>
        </>
      )}

      {tab === 'timeline' && (
        <ProjectTimeline project={project} tasks={tasks} content={content} />
      )}

      {tab === 'resources' && <ProjectResources projectId={projectId} />}
    </>
  )
}

export default ProjectDetail
