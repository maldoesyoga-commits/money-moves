import { NavLink } from 'react-router-dom'
import { HomeIcon, AccountsIcon, TransactionsIcon, ReceiptsIcon, InsightsIcon } from './icons'

// The one bottom bar in the app. Five is what fits a phone; everything
// else is one tap away on the hub.
const TABS = [
  { to: '/', label: 'Hub', Icon: HomeIcon, end: true },
  { to: '/money', label: 'Money', Icon: AccountsIcon },
  { to: '/tasks', label: 'Tasks', Icon: TransactionsIcon },
  { to: '/notes', label: 'Notes', Icon: ReceiptsIcon },
  { to: '/planning', label: 'Planning', Icon: InsightsIcon },
]

function GlobalNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-tab${isActive ? ' active' : ''}`}
        >
          <Icon className="bottom-nav-icon" />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default GlobalNav
