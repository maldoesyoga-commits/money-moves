import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  InsightsIcon,
  AccountsIcon,
  TransactionsIcon,
  IncomeIcon,
  SavingsIcon,
  DebtsIcon,
  MoreIcon,
} from './icons'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/insights', label: 'Insights', Icon: InsightsIcon },
  { to: '/accounts', label: 'Accounts', Icon: AccountsIcon },
  { to: '/transactions', label: 'Transactions', Icon: TransactionsIcon },
  { to: '/income', label: 'Income', Icon: IncomeIcon },
  { to: '/savings', label: 'Savings', Icon: SavingsIcon },
  { to: '/debts', label: 'Debts', Icon: DebtsIcon },
  { to: '/more', label: 'More', Icon: MoreIcon },
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
