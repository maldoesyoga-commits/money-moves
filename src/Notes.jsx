import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import NoteList from './NoteList'
import Notebooks from './Notebooks'
import Notebook from './Notebook'
import Journal from './Journal'

const TABS = [
  { to: '/notes', label: 'Notebooks', end: true },
  { to: '/notes/all', label: 'All notes' },
  { to: '/notes/journal', label: 'Journal' },
]

function Notes() {
  return (
    <section className="notes-module">
      <div className="home-greeting">
        <h1>Notes</h1>
        <p className="list-row-sub">Somewhere to put the things that aren&apos;t tasks.</p>
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
        <Route path="/" element={<Notebooks />} />
        <Route path="book/:notebookId" element={<Notebook />} />
        <Route path="all" element={<NoteList />} />
        <Route path="journal" element={<Journal />} />
        <Route path="*" element={<Navigate to="/notes" replace />} />
      </Routes>
    </section>
  )
}

export default Notes
