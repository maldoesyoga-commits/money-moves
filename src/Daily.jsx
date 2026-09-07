import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import DailyToday from './DailyToday'
import DailyHistory from './DailyHistory'
import Habits from './Habits'

const TABS = [
  { to: '/daily', label: 'Today', end: true },
  { to: '/daily/history', label: 'History' },
  { to: '/daily/habits', label: 'Habits' },
]

function Daily() {
  return (
    <section className="daily-module">
      <div className="home-greeting">
        <h1>Daily</h1>
        <p className="list-row-sub">One row a day — sleep, mood, water, habits.</p>
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
        <Route path="/" element={<DailyToday />} />
        <Route path="history" element={<DailyHistory />} />
        <Route path="habits" element={<Habits />} />
        <Route path="*" element={<Navigate to="/daily" replace />} />
      </Routes>
    </section>
  )
}

export default Daily
