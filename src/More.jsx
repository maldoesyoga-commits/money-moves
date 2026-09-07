import { Link } from 'react-router-dom'
import Subscriptions from './Subscriptions'
import Categories from './Categories'
import {
  AccountsIcon,
  IncomeIcon,
  DebtsIcon,
  ImportIcon,
  ReceiptsIcon,
} from './icons'

const PAGES = [
  { to: '/money/accounts', label: 'Accounts', Icon: AccountsIcon, sub: 'Balances and buckets' },
  { to: '/money/income', label: 'Income', Icon: IncomeIcon, sub: 'Log a payment and split it' },
  { to: '/money/debts', label: 'Debts', Icon: DebtsIcon, sub: 'What you owe' },
  { to: '/money/import', label: 'Import', Icon: ImportIcon, sub: 'Paste a statement' },
  { to: '/money/receipts', label: 'Receipts', Icon: ReceiptsIcon, sub: 'Attached documents' },
]

function More() {
  return (
    <section className="more">
      <h1>More</h1>

      <div className="card">
        <ul className="list">
          {PAGES.map(({ to, label, Icon, sub }) => (
            <li key={to} className="list-row">
              <Link to={to} className="more-link">
                <Icon className="bottom-nav-icon" />
                <span className="list-row-main">
                  <span className="list-row-title">{label}</span>
                  <span className="list-row-sub">{sub}</span>
                </span>
                <span className="more-chevron">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Subscriptions />
      <Categories />
    </section>
  )
}

export default More
