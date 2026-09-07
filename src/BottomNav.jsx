import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  TransactionsIcon,
  InsightsIcon,
  SavingsIcon,
  MoreIcon,
} from './icons'

// Five tabs is the most that fits comfortably on a phone.
// Everything else lives on the More page.
const TABS = [
  { to: '/money', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/money/transactions', label: 'Transactions', Icon: TransactionsIcon },
  { to: '/money/insights', label: 'Insights', Icon: InsightsIcon },
  { to: '/money/savings', label: 'Savings', Icon: SavingsIcon },
  { to: '/money/more', label: 'More', Icon: MoreIcon },
]

function BottomNav() {
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

export default BottomNav
