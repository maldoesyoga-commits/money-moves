import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Home() {
  const [accounts, setAccounts] = useState([])
  const [debts, setDebts] = useState([])
  const [debtEntries, setDebtEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])

  async function loadAccounts() {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')

    if (error) {
      console.error('Failed to load accounts', error)
      return
    }

    setAccounts(data)
  }

  async function loadDebts() {
    const { data, error } = await supabase.from('debts').select('*')

    if (error) {
      console.error('Failed to load debts', error)
      return
    }

    setDebts(data)
  }

  async function loadDebtEntries() {
    const { data, error } = await supabase.from('debt_entries').select('*')

    if (error) {
      console.error('Failed to load debt entries', error)
      return
    }

    setDebtEntries(data)
  }

  async function loadTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('txn_date', { ascending: false })

    if (error) {
      console.error('Failed to load transactions', error)
      return
    }

    setTransactions(data)
  }

  async function loadCategories() {
    const { data, error } = await supabase.from('categories').select('*')

    if (error) {
      console.error('Failed to load categories', error)
      return
    }

    setCategories(data)
  }

  useEffect(() => {
    loadAccounts()
    loadDebts()
    loadDebtEntries()
    loadTransactions()
    loadCategories()
  }, [])

  function categoryName(categoryId) {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : 'Uncategorized'
  }

  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)

  const totalDebtRemaining = debts.reduce((sum, debt) => {
    const start = Number(debt.start_balance) || 0
    const draws = debtEntries
      .filter((entry) => entry.debt_id === debt.id && entry.direction === 'draw')
      .reduce((s, entry) => s + Number(entry.amount || 0), 0)
    const paid = transactions
      .filter((txn) => txn.debt_id === debt.id && txn.direction === 'out')
      .reduce((s, txn) => s + Number(txn.amount || 0), 0)
    return sum + start + draws - paid
  }, 0)

  const now = new Date()
  const monthStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEnd = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const monthTransactions = transactions.filter(
    (txn) => txn.txn_date >= monthStart && txn.txn_date <= monthEnd,
  )
  const moneyIn = monthTransactions
    .filter((txn) => txn.direction === 'in')
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  const moneyOut = monthTransactions
    .filter((txn) => txn.direction === 'out')
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  const incomeAfterExpenses = moneyIn - moneyOut

  const latestTransactions = transactions.slice(0, 5)

  const todayLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <section className="home">
      <div className="home-greeting">
        <h1>{greetingForHour(now.getHours())}</h1>
        <p className="list-row-sub">{todayLabel}</p>
      </div>

      <div className="card home-hero">
        <p className="home-hero-label">Total balance</p>
        <p className="home-hero-amount">{formatMoney(totalBalance)}</p>
        <p className="home-hero-debt">{formatMoney(totalDebtRemaining)} in debt remaining</p>
      </div>

      <div className="card">
        <h2>Accounts</h2>
        <ul className="list">
          {accounts.map((account) => (
            <li key={account.id} className="list-row">
              <span className="list-row-title">{account.name}</span>
              <span className="money">{formatMoney(account.balance)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>This month</h2>
        <ul className="list">
          <li className="list-row">
            <span className="list-row-title">Money in</span>
            <span className="amount-in">+{formatMoney(moneyIn)}</span>
          </li>
          <li className="list-row">
            <span className="list-row-title">Money out</span>
            <span className="amount-out">-{formatMoney(moneyOut)}</span>
          </li>
        </ul>
        <div className="home-net-row">
          <p>Income after expenses</p>
          <p className={`money ${incomeAfterExpenses >= 0 ? 'amount-in' : 'amount-out'}`}>
            {formatMoney(incomeAfterExpenses)}
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Latest transactions</h2>
        {latestTransactions.length > 0 ? (
          <ul className="list">
            {latestTransactions.map((txn) => (
              <li key={txn.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{categoryName(txn.category_id)}</span>
                  <span className="list-row-sub">{txn.txn_date}</span>
                </div>
                <span className={txn.direction === 'in' ? 'amount-in' : 'amount-out'}>
                  {txn.direction === 'in' ? '+' : '-'}
                  {formatMoney(txn.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-text">No transactions yet.</p>
        )}
      </div>
    </section>
  )
}

export default Home
