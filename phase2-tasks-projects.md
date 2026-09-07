# Homestead — Phase 2: Tasks & Projects
Exact steps + every line of code.

All of this is **already written into `C:\Users\Lenovo\Documents\money-moves`**. The code below is for reference / if you want to re-create it by hand.

---

## The steps, in order

### Step 1 — Run the SQL in Supabase
1. Go to https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
2. Paste the contents of `supabase/tasks.sql` (Section A below)
3. Click **Run**
4. You should see: `Success. No rows returned.`

**Checkpoint:** In Supabase, Table Editor now shows a `projects` table and a `tasks` table.

### Step 2 — Start the app
Open a terminal (PowerShell, or the terminal inside VS Code):

```
cd C:\Users\Lenovo\Documents\money-moves
npm run dev
```

It prints a link like `http://localhost:5173/` — ctrl+click it, or paste it in your browser.
Stop the server later with `Ctrl + C`.

### Step 3 — Test it (the checkpoint that matters)
1. Log in. On the hub, the **Tasks & Projects** card is now tappable (no "coming soon" badge).
2. Tap it. Type a task in the box, pick today's date, hit **Add task**.
3. It shows under the **Today** tab.
4. Go to the **Projects** tab, create a project, pick a colour.
5. Back on **Tasks**, tap **Edit** on your task and assign it that project.
6. Tap the circle to mark it done — it moves to the **Done** tab with a strikethrough.
7. **Refresh the page.** Everything should still be there.

If something breaks: press F12 in the browser, open the **Console** tab, and send me whatever red text is there.

### Step 4 — Push it live
```
git add -A
git commit -m "Add Tasks & Projects module"
git push
```

---

## What each file does

| File | Purpose |
|---|---|
| `supabase/tasks.sql` | Creates the two tables + row-level security so you only see your own rows |
| `src/lib/taskDates.js` | Turns a date into friendly wording — "Today", "Tomorrow", "3 days ago" |
| `src/Tasks.jsx` | The module shell — the Tasks / Projects toggle and the routes |
| `src/TaskList.jsx` | The task list: quick-add, view tabs, complete, inline edit, delete |
| `src/Projects.jsx` | The projects list: create, colour, counts, inline edit, archive |
| `src/App.jsx` | **Changed** — added the `/tasks/*` route |
| `src/HomeHub.jsx` | **Changed** — Tasks card is now enabled |
| `src/index.css` | **Changed** — new styles appended at the bottom |

---

## Section A — `supabase/tasks.sql`

```sql
-- Homestead — Phase 2: Tasks & Projects
-- Run in: https://supabase.com/dashboard/project/ekjmzozryodivzuafumo/sql/new
-- Expect: "Success. No rows returned."

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active','on_hold','done','archived')),
  color       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  notes       text,
  project_id  uuid references public.projects(id) on delete set null,
  status      text not null default 'todo' check (status in ('todo','doing','done')),
  priority    text check (priority in ('low','med','high')),
  due_date    date,
  done_at     timestamptz,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

drop policy if exists "own projects" on public.projects;
drop policy if exists "own tasks"    on public.tasks;
create policy "own projects" on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks"    on public.tasks    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_tasks_user_due on public.tasks (user_id, due_date);
create index if not exists idx_tasks_project  on public.tasks (project_id);
```

---

## Section B — `src/lib/taskDates.js` (new file)

```jsx
export function todayISO() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

export function formatDueDate(iso) {
  if (!iso) return 'No date'

  const today = todayISO()
  if (iso === today) return 'Today'

  const dayMs = 86400000
  const diff = Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today}T00:00:00`)) / dayMs)

  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)} days ago`
  if (diff <= 6) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
  }

  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function isOverdue(iso) {
  return Boolean(iso) && iso < todayISO()
}
```

---

## Section C — `src/Tasks.jsx` (new file)

```jsx
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import TaskList from './TaskList'
import Projects from './Projects'

const TABS = [
  { to: '/tasks', label: 'Tasks', end: true },
  { to: '/tasks/projects', label: 'Projects' },
]

function Tasks() {
  return (
    <section className="tasks-module">
      <div className="home-greeting">
        <h1>Tasks &amp; Projects</h1>
        <p className="list-row-sub">Capture it, then forget about it.</p>
      </div>

      <nav className="segmented-nav">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `segmented-tab${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<TaskList />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<TaskList />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </section>
  )
}

export default Tasks
```

---

## Section D — `src/TaskList.jsx` (new file)

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { todayISO, formatDueDate, isOverdue } from './lib/taskDates'

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'nodate', label: 'No date' },
  { key: 'done', label: 'Done' },
]

const PRIORITY_LABEL = { high: 'High', med: 'Medium', low: 'Low' }

function TaskList() {
  const { projectId } = useParams()

  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [view, setView] = useState('today')
  const [projectFilter, setProjectFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [newProjectId, setNewProjectId] = useState('')

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { nullsFirst: false })
      .order('created_at')

    if (error) {
      console.log('Failed to load tasks', error.message)
      return
    }

    setTasks(data)
  }, [])

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load projects', error.message)
      return
    }

    setProjects(data)
  }, [])

  useEffect(() => {
    loadTasks()
    loadProjects()
  }, [loadTasks, loadProjects])

  useEffect(() => {
    if (projectId) setNewProjectId(projectId)
  }, [projectId])

  const activeProject = projects.find((project) => project.id === projectId)

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) return

    const payload = { title: trimmed, status: 'todo' }
    if (dueDate) payload.due_date = dueDate

    const chosenProject = projectId || newProjectId
    if (chosenProject) payload.project_id = chosenProject

    const { error } = await supabase.from('tasks').insert(payload)

    if (error) {
      console.log('Failed to add task', error.message)
      return
    }

    setTitle('')
    setDueDate('')
    loadTasks()
  }

  async function updateTask(id, patch) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)))

    const { error } = await supabase.from('tasks').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update task', error.message)
      loadTasks()
    }
  }

  function toggleDone(task) {
    const done = task.status !== 'done'
    updateTask(task.id, {
      status: done ? 'done' : 'todo',
      done_at: done ? new Date().toISOString() : null,
    })
  }

  async function deleteTask(id) {
    setTasks((prev) => prev.filter((task) => task.id !== id))

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      console.log('Failed to delete task', error.message)
      loadTasks()
    }
  }

  const visible = useMemo(() => {
    const today = todayISO()

    return tasks.filter((task) => {
      if (projectId && task.project_id !== projectId) return false
      if (!projectId && projectFilter !== 'all') {
        if (projectFilter === 'none' ? task.project_id : task.project_id !== projectFilter) {
          return false
        }
      }

      const done = task.status === 'done'

      if (view === 'done') return done
      if (done) return false
      if (view === 'today') return Boolean(task.due_date) && task.due_date <= today
      if (view === 'upcoming') return Boolean(task.due_date) && task.due_date > today
      return !task.due_date
    })
  }, [tasks, view, projectFilter, projectId])

  function projectName(id) {
    return projects.find((project) => project.id === id)?.name
  }

  function countFor(key) {
    const today = todayISO()
    return tasks.filter((task) => {
      if (projectId && task.project_id !== projectId) return false
      const done = task.status === 'done'
      if (key === 'done') return done
      if (done) return false
      if (key === 'today') return Boolean(task.due_date) && task.due_date <= today
      if (key === 'upcoming') return Boolean(task.due_date) && task.due_date > today
      return !task.due_date
    }).length
  }

  return (
    <div className="card">
      {activeProject && (
        <div className="project-scope-header">
          <h2>{activeProject.name}</h2>
          <Link to="/tasks/projects" className="row-action-btn">
            All projects
          </Link>
        </div>
      )}

      <form className="quick-add" onSubmit={handleAdd}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="quick-add-title"
        />
        <div className="field-row">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          {!projectId && (
            <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects
                .filter((project) => project.status === 'active')
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          )}
          <button type="submit">Add task</button>
        </div>
      </form>

      <nav className="view-tabs">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`view-tab${view === key ? ' active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
            <span className="view-tab-count">{countFor(key)}</span>
          </button>
        ))}
      </nav>

      {!projectId && projects.length > 0 && (
        <div className="transaction-filter-bar">
          <label className="filter-toggle">
            Project
            <select
              className="inline-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="none">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="empty-text">
          {view === 'done' ? 'Nothing finished yet.' : 'Nothing here — enjoy the quiet.'}
        </p>
      ) : (
        <ul className="list">
          {visible.map((task) => {
            const done = task.status === 'done'
            const overdue = !done && isOverdue(task.due_date)
            const open = expandedId === task.id

            return (
              <li key={task.id} className={`list-row task-row${done ? ' task-done' : ''}`}>
                <div className="task-row-body">
                  <button
                    type="button"
                    className={`task-check${done ? ' checked' : ''}`}
                    onClick={() => toggleDone(task)}
                    aria-label={done ? 'Mark as not done' : 'Mark as done'}
                  >
                    {done ? '✓' : ''}
                  </button>

                  <div className="list-row-main task-main">
                    <span className="list-row-title task-title">{task.title}</span>
                    <span className="list-row-sub task-meta">
                      <span className={overdue ? 'task-overdue' : undefined}>
                        {formatDueDate(task.due_date)}
                      </span>
                      {task.priority && <span className={`priority-pill priority-${task.priority}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>}
                      {task.project_id && <span>{projectName(task.project_id)}</span>}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setExpandedId(open ? null : task.id)}
                  >
                    {open ? 'Close' : 'Edit'}
                  </button>
                </div>

                {open && (
                  <div className="task-controls">
                    <input
                      type="date"
                      className="inline-select"
                      value={task.due_date || ''}
                      onChange={(e) => updateTask(task.id, { due_date: e.target.value || null })}
                    />
                    <select
                      className="inline-select"
                      value={task.priority || ''}
                      onChange={(e) => updateTask(task.id, { priority: e.target.value || null })}
                    >
                      <option value="">No priority</option>
                      <option value="high">High</option>
                      <option value="med">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <select
                      className="inline-select"
                      value={task.project_id || ''}
                      onChange={(e) => updateTask(task.id, { project_id: e.target.value || null })}
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="row-action-btn row-action-btn-danger"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default TaskList
```

---

## Section E — `src/Projects.jsx` (new file)

```jsx
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
  { value: 'archived', label: 'Archived' },
]

const COLORS = ['#3f6b5c', '#b87333', '#4e6e8a', '#bf8f6b', '#6e7a75']

function Projects() {
  const [projects, setProjects] = useState([])
  const [taskCounts, setTaskCounts] = useState({})
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load projects', error.message)
      return
    }

    setProjects(data)
  }, [])

  const loadCounts = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('project_id, status')

    if (error) {
      console.log('Failed to load task counts', error.message)
      return
    }

    const counts = {}
    data.forEach((task) => {
      if (!task.project_id) return
      const entry = counts[task.project_id] || { open: 0, done: 0 }
      if (task.status === 'done') entry.done += 1
      else entry.open += 1
      counts[task.project_id] = entry
    })

    setTaskCounts(counts)
  }, [])

  useEffect(() => {
    loadProjects()
    loadCounts()
  }, [loadProjects, loadCounts])

  async function handleCreate(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed, color, sort_order: projects.length }
    if (description.trim()) payload.description = description.trim()

    const { error } = await supabase.from('projects').insert(payload)

    if (error) {
      console.log('Failed to create project', error.message)
      return
    }

    setName('')
    setDescription('')
    setColor(COLORS[0])
    loadProjects()
  }

  async function updateProject(id, patch) {
    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, ...patch } : project)))

    const { error } = await supabase.from('projects').update(patch).eq('id', id)

    if (error) {
      console.log('Failed to update project', error.message)
      loadProjects()
    }
  }

  const visible = projects.filter((project) => showArchived || project.status !== 'archived')

  return (
    <div className="card">
      <h2>Projects</h2>

      <form onSubmit={handleCreate}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="project name"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="description (optional)"
          />
        </div>
        <div className="color-picker-row">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`color-swatch${color === swatch ? ' selected' : ''}`}
              style={{ background: swatch }}
              onClick={() => setColor(swatch)}
              aria-label={`Colour ${swatch}`}
            />
          ))}
        </div>
        <button type="submit">Create project</button>
      </form>

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="empty-text">No projects yet.</p>
      ) : (
        <ul className="list">
          {visible.map((project) => {
            const counts = taskCounts[project.id] || { open: 0, done: 0 }
            const editing = editingId === project.id

            return (
              <li key={project.id} className="list-row project-row">
                <div className="task-row-body">
                  <span
                    className="project-dot"
                    style={{ background: project.color || 'var(--text-soft)' }}
                  />
                  <div className="list-row-main task-main">
                    <Link to={`/tasks/projects/${project.id}`} className="list-row-title project-link">
                      {project.name}
                    </Link>
                    <span className="list-row-sub">
                      {counts.open} open · {counts.done} done
                      {project.description ? ` — ${project.description}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => setEditingId(editing ? null : project.id)}
                  >
                    {editing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {editing && (
                  <div className="task-controls">
                    <input
                      type="text"
                      className="inline-select"
                      value={project.name}
                      onChange={(e) => updateProject(project.id, { name: e.target.value })}
                    />
                    <input
                      type="text"
                      className="inline-select"
                      value={project.description || ''}
                      placeholder="description"
                      onChange={(e) =>
                        updateProject(project.id, { description: e.target.value || null })
                      }
                    />
                    <select
                      className="inline-select"
                      value={project.status}
                      onChange={(e) => updateProject(project.id, { status: e.target.value })}
                    >
                      {STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <div className="color-picker-row">
                      {COLORS.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          className={`color-swatch${project.color === swatch ? ' selected' : ''}`}
                          style={{ background: swatch }}
                          onClick={() => updateProject(project.id, { color: swatch })}
                          aria-label={`Colour ${swatch}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Projects
```

---

## Section F — `src/App.jsx` (two small changes)

**1.** Under the other imports at the top, add the last line:

```jsx
import HomeHub from './HomeHub'
import MoneyMoves from './MoneyMoves'
import Tasks from './Tasks'
```

**2.** In the `<Routes>` block, add the tasks line:

```jsx
<Routes>
  <Route path="/" element={<HomeHub />} />
  <Route path="/money/*" element={<MoneyMoves />} />
  <Route path="/tasks/*" element={<Tasks />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

---

## Section G — `src/HomeHub.jsx` (one small change)

Find the `tasks` entry in the `MODULES` array and change it to:

```jsx
{
  key: 'tasks',
  icon: '✅',
  name: 'Tasks & Projects',
  tagline: 'Plan and track your to-dos',
  path: '/tasks',
  enabled: true,
},
```

That's it — the hub already knows how to render an enabled card, it just needed a `path` and `enabled: true`.

---

## Section H — `src/index.css` (append to the very bottom)

Everything below goes at the end of the existing file. Nothing above it changes.

```css
.tasks-module {
  padding-bottom: 40px;
}

.segmented-nav {
  display: inline-flex;
  gap: 4px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 20px;
}

.segmented-tab {
  padding: 7px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-soft);
  text-decoration: none;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.segmented-tab:hover {
  color: var(--sage);
}

.segmented-tab.active {
  color: var(--sage);
  background: var(--sage-soft);
}

.quick-add {
  gap: 10px;
}

.quick-add-title {
  font-size: 16px;
  padding: 12px 16px;
}

.view-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.view-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-soft);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  align-self: auto;
}

.view-tab:hover {
  color: var(--sage);
  border-color: var(--sage);
  background: var(--sage-soft);
}

.view-tab.active {
  color: var(--sage);
  border-color: var(--sage);
  background: var(--sage-soft);
}

.view-tab-count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.task-row,
.project-row {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.task-row-body {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.task-main {
  flex: 1;
}

.task-check {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  padding: 0;
  font-size: 13px;
  line-height: 1;
  color: #fff;
  background: transparent;
  border: 1.5px solid var(--border);
  border-radius: 50%;
  align-self: auto;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.task-check:hover {
  border-color: var(--sage);
  background: var(--sage-soft);
}

.task-check.checked,
.task-check.checked:hover {
  background: var(--sage);
  border-color: var(--sage);
}

.task-done .task-title {
  color: var(--text-soft);
  text-decoration: line-through;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.task-overdue {
  color: var(--terracotta-muted-text);
  font-weight: 600;
}

.priority-pill {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--border);
  color: var(--text-soft);
}

.priority-pill.priority-high {
  background: var(--terracotta-muted-soft);
  color: var(--terracotta-muted-text);
}

.priority-pill.priority-med {
  background: var(--clay-soft);
  color: var(--clay);
}

.priority-pill.priority-low {
  background: var(--sage-soft);
  color: var(--sage);
}

.task-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.project-scope-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.project-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.project-link {
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
}

.project-link:hover {
  color: var(--sage);
}

.color-picker-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: 0 0 0 1px var(--border);
  align-self: auto;
  flex: 0 0 auto;
}

.color-swatch.selected {
  border-color: var(--card-bg);
  box-shadow: 0 0 0 2px var(--text);
}
```

---

## If you want to build this from scratch instead

1. Create `supabase/tasks.sql`, `src/lib/taskDates.js`, `src/Tasks.jsx`, `src/TaskList.jsx`, `src/Projects.jsx` — paste sections A–E.
2. Make the two edits in `src/App.jsx` (Section F) and one in `src/HomeHub.jsx` (Section G).
3. Paste Section H at the bottom of `src/index.css`.
4. Run the SQL, then `npm run dev`.

No new packages needed — it uses React, react-router-dom and Supabase, all already installed.
