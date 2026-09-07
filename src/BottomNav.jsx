import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  InsightsIcon,
  AccountsIcon,
  TransactionsIcon,
  IncomeIcon,
  SavingsIcon,
  DebtsIcon,
  ImportIcon,
  ReceiptsIcon,
  MoreIcon,
} from './icons'

const TABS = [
  { to: '/money', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/money/insights', label: 'Insights', Icon: InsightsIcon },
  { to: '/money/accounts', label: 'Accounts', Icon: AccountsIcon },
  { to: '/money/transactions', label: 'Transactions', Icon: TransactionsIcon },
  { to: '/money/income', label: 'Income', Icon: IncomeIcon },
  { to: '/money/savings', label: 'Savings', Icon: SavingsIcon },
  { to: '/money/debts', label: 'Debts', Icon: DebtsIcon },
  { to: '/money/import', label: 'Import', Icon: ImportIcon },
  { to: '/money/receipts', label: 'Receipts', Icon: ReceiptsIcon },
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
