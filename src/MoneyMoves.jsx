import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './Home'
import Insights from './Insights'
import Income from './Income'
import Accounts from './Accounts'
import Savings from './Savings'
import Debts from './Debts'
import Transactions from './Transactions'
import Import from './Import'
import Receipts from './Receipts'
import More from './More'
import BottomNav from './BottomNav'
import { PeriodProvider } from './PeriodContext'

function MoneyMoves() {
  return (
    <PeriodProvider>
      <div className="money-module">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="insights" element={<Insights />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="income" element={<Income />} />
          <Route path="savings" element={<Savings />} />
          <Route path="debts" element={<Debts />} />
          <Route path="import" element={<Import />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="more" element={<More />} />
          <Route path="*" element={<Navigate to="/money" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </PeriodProvider>
  )
}

export default MoneyMoves
