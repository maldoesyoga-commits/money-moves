import { NavLink } from 'react-router-dom'

// The one bottom bar in the app — every area, one tap away. On a wide screen
// the tabs spread across the whole bar; on a phone the bar scrolls sideways so
// nothing gets crushed. Order and icons mirror the hub's module grid.
const TABS = [
  { to: '/', label: 'Hub', icon: '🌿', end: true },
  { to: '/money', label: 'Money', icon: '💰' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/daily', label: 'Daily', icon: '🌅' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/planning', label: 'Planning', icon: '🗓️' },
  { to: '/learning', label: 'Learning', icon: '📚' },
  { to: '/content', label: 'Content', icon: '🎬' },
  { to: '/brand', label: 'Brand', icon: '🎨' },
  { to: '/freelance', label: 'Freelance', icon: '💼' },
  { to: '/cookie-jar', label: 'Jar', icon: '🍪' },
  { to: '/milestones', label: 'Milestones', icon: '🏔️' },
  { to: '/household', label: 'Household', icon: '🏠' },
]

function GlobalNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-tab${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-emoji" aria-hidden="true">
            {icon}
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default GlobalNav
