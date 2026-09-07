import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import Clients from './Clients'
import FreelanceProjects from './FreelanceProjects'
import TimeLog from './TimeLog'
import Invoices from './Invoices'

const TABS = [
  { to: '/freelance', label: 'Clients', end: true },
  { to: '/freelance/projects', label: 'Projects' },
  { to: '/freelance/time', label: 'Time' },
  { to: '/freelance/invoices', label: 'Invoices' },
]

function Freelance() {
  return (
    <section className="freelance-module">
      <div className="home-greeting">
        <h1>Freelance</h1>
        <p className="list-row-sub">Clients, projects, hours and what you&apos;re owed.</p>
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
        <Route path="/" element={<Clients />} />
        <Route path="projects" element={<FreelanceProjects />} />
        <Route path="time" element={<TimeLog />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="*" element={<Navigate to="/freelance" replace />} />
      </Routes>
    </section>
  )
}

export default Freelance
