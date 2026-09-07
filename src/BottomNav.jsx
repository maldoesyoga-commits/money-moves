import { NavLink } from 'react-router-dom'

// Money Moves' own section nav. Sits at the top of the module like every
// other module's nav — the only bottom bar in the app is the global one.
const TABS = [
  { to: '/money', label: 'Home', end: true },
  { to: '/money/transactions', label: 'Transactions' },
  { to: '/money/insights', label: 'Insights' },
  { to: '/money/savings', label: 'Savings' },
  { to: '/money/more', label: 'More' },
]

function BottomNav() {
  return (
    <nav className="segmented-nav money-nav">
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
  )
}

export default BottomNav
