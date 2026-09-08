import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './Home'
import Insights from './Insights'
import Income from './Income'
import Accounts from './Accounts'
import AccountDetail from './AccountDetail'
import Savings from './Savings'
import Debts from './Debts'
import Transactions from './Transactions'
import Import from './Import'
import Receipts from './Receipts'
import More from './More'
import Budgets from './Budgets'
import BottomNav from './BottomNav'
import { PeriodProvider } from './PeriodContext'

function MoneyMoves() {
  return (
    <PeriodProvider>
      <div className="money-module">
        <div className="home-greeting">
          <h1>Money Moves</h1>
          <p className="list-row-sub">Budget, transactions and insights.</p>
        </div>

        <BottomNav />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="insights" element={<Insights />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:accountId" element={<AccountDetail />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="income" element={<Income />} />
          <Route path="savings" element={<Savings />} />
          <Route path="debts" element={<Debts />} />
          <Route path="import" element={<Import />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="more" element={<More />} />
          <Route path="*" element={<Navigate to="/money" replace />} />
        </Routes>
      </div>
    </PeriodProvider>
  )
}

export default MoneyMoves
