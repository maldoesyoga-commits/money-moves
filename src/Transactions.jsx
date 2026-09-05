import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [debts, setDebts] = useState([])
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [debtId, setDebtId] = useState('')

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
    if (data && data.length > 0) setCategoryId(data[0].id)
  }

  async function loadDebts() {
    const { data, error } = await supabase.from('debts').select('*')

    if (error) {
      console.error('Failed to load debts', error)
      return
    }

    setDebts(data)
  }

  useEffect(() => {
    loadTransactions()
    loadCategories()
    loadDebts()

    const channel = supabase
      .channel('txns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => loadTransactions())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleAdd(e) {
    e.preventDefault()

    const payload = {
      amount: Number(amount),
      category_id: categoryId,
      direction: 'out',
    }
    if (debtId) payload.debt_id = debtId

    const { error } = await supabase.from('transactions').insert(payload)

    if (error) {
      console.error(error.message)
      return
    }

    setAmount('')
    setDebtId('')
  }

  function categoryName(categoryId) {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : ''
  }

  return (
    <div className="card">
      <h2>Transactions</h2>
      <form onSubmit={handleAdd}>
        <div className="field-row">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="amount"
            required
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <label>
          Debt payment toward (optional)
          <select value={debtId} onChange={(e) => setDebtId(e.target.value)}>
            <option value="">None</option>
            {debts.map((debt) => (
              <option key={debt.id} value={debt.id}>
                {debt.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Add</button>
      </form>
      <ul className="list">
        {transactions.map((txn) => (
          <li key={txn.id} className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">{categoryName(txn.category_id)}</span>
              <span className="list-row-sub">{txn.txn_date}</span>
            </div>
            <span className="money">{formatMoney(txn.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Transactions
