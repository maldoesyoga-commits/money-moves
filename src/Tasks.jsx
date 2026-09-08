import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import TaskList from './TaskList'
import Projects from './Projects'
import ProjectDetail from './ProjectDetail'
import TaskTemplates from './TaskTemplates'

const TABS = [
  { to: '/tasks', label: 'Tasks', end: true },
  { to: '/tasks/projects', label: 'Projects' },
  { to: '/tasks/templates', label: 'Templates' },
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
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="templates" element={<TaskTemplates />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </section>
  )
}

export default Tasks
