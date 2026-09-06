import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function effectDeltas(txn, sign) {
  const amount = (Number(txn.amount) || 0) * sign
  const deltas = []

  if (txn.direction === 'out') {
    if (txn.from_account_id) deltas.push({ accountId: txn.from_account_id, delta: -amount })
  } else if (txn.direction === 'in') {
    if (txn.to_account_id) deltas.push({ accountId: txn.to_account_id, delta: amount })
  } else if (txn.direction === 'transfer') {
    if (txn.from_account_id) deltas.push({ accountId: txn.from_account_id, delta: -amount })
    if (txn.to_account_id) deltas.push({ accountId: txn.to_account_id, delta: amount })
  }

  return deltas
}

function mergeDeltaLists(...lists) {
  const map = new Map()
  for (const list of lists) {
    for (const { accountId, delta } of list) {
      if (!accountId) continue
      map.set(accountId, (map.get(accountId) || 0) + delta)
    }
  }
  return map
}

async function applyBalanceDeltas(deltaMap) {
  for (const [accountId, delta] of deltaMap.entries()) {
    if (!delta) continue

    const { data: account, error: fetchError } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .single()

    if (fetchError) {
      console.log(fetchError.message)
      return false
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update({ balance: Number(account.balance || 0) + delta })
      .eq('id', accountId)

    if (updateError) {
      console.log(updateError.message)
      return false
    }
  }

  return true
}

function directionLabel(direction) {
  if (direction === 'in') return 'In'
  if (direction === 'transfer') return 'Transfer'
  return 'Out'
}

function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [debtId, setDebtId] = useState('')
  const [direction, setDirection] = useState('out')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editDebtId, setEditDebtId] = useState('')
  const [editDirection, setEditDirection] = useState('out')
  const [editFromAccountId, setEditFromAccountId] = useState('')
  const [editToAccountId, setEditToAccountId] = useState('')

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

  async function loadAccounts() {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')

    if (error) {
      console.error('Failed to load accounts', error)
      return
    }

    setAccounts(data)
  }

  useEffect(() => {
    loadTransactions()
    loadCategories()
    loadDebts()
    loadAccounts()

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
      category_id: categoryId || null,
      direction,
      from_account_id: fromAccountId || null,
      to_account_id: toAccountId || null,
    }
    if (debtId) payload.debt_id = debtId

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.log(error.message)
      return
    }

    const deltaMap = mergeDeltaLists(effectDeltas(inserted, 1))
    const balancesOk = await applyBalanceDeltas(deltaMap)
    if (!balancesOk) {
      console.log('Transaction saved but its account balance could not be updated')
    }

    setAmount('')
    setDebtId('')
    setFromAccountId('')
    setToAccountId('')
    loadTransactions()
  }

  function startEdit(txn) {
    setEditingId(txn.id)
    setEditDate(txn.txn_date || '')
    setEditAmount(String(txn.amount ?? ''))
    setEditCategoryId(txn.category_id || '')
    setEditDebtId(txn.debt_id || '')
    setEditDirection(txn.direction || 'out')
    setEditFromAccountId(txn.from_account_id || '')
    setEditToAccountId(txn.to_account_id || '')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(e, id) {
    e.preventDefault()

    const { data: oldTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.log(fetchError.message)
      return
    }

    const newTxn = {
      txn_date: editDate,
      amount: Number(editAmount),
      category_id: editCategoryId || null,
      debt_id: editDebtId || null,
      direction: editDirection,
      from_account_id: editFromAccountId || null,
      to_account_id: editToAccountId || null,
    }

    const deltaMap = mergeDeltaLists(effectDeltas(oldTxn, -1), effectDeltas(newTxn, 1))
    const balancesOk = await applyBalanceDeltas(deltaMap)
    if (!balancesOk) return

    const { error: updateError } = await supabase.from('transactions').update(newTxn).eq('id', id)

    if (updateError) {
      console.log(updateError.message)
      return
    }

    setEditingId(null)
    loadTransactions()
  }

  async function handleDelete(id) {
    const { data: oldTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.log(fetchError.message)
      return
    }

    const deltaMap = mergeDeltaLists(effectDeltas(oldTxn, -1))
    const balancesOk = await applyBalanceDeltas(deltaMap)
    if (!balancesOk) return

    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id)

    if (deleteError) {
      console.log(deleteError.message)
      return
    }

    if (editingId === id) setEditingId(null)
    loadTransactions()
  }

  function categoryName(categoryId) {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : ''
  }

  function accountName(accountId) {
    const account = accounts.find((a) => a.id === accountId)
    return account ? account.name : ''
  }

  function accountFlowLabel(txn) {
    const from = accountName(txn.from_account_id)
    const to = accountName(txn.to_account_id)
    if (txn.direction === 'transfer' && from && to) return `${from} → ${to}`
    if (txn.direction === 'out' && from) return `from ${from}`
    if (txn.direction === 'in' && to) return `to ${to}`
    return ''
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
            step="0.01"
            required
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="out">Out</option>
            <option value="in">In</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="field-row">
          <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
            <option value="">From account —</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">To account —</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
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
          <li key={txn.id} className="list-row transaction-row">
            {editingId === txn.id ? (
              <form className="transaction-edit-form" onSubmit={(e) => handleSaveEdit(e, txn.id)}>
                <div className="field-row">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                  <select value={editDirection} onChange={(e) => setEditDirection(e.target.value)}>
                    <option value="out">Out</option>
                    <option value="in">In</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div className="field-row">
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    <option value="">—</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editFromAccountId}
                    onChange={(e) => setEditFromAccountId(e.target.value)}
                  >
                    <option value="">From account —</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editToAccountId}
                    onChange={(e) => setEditToAccountId(e.target.value)}
                  >
                    <option value="">To account —</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-row">
                  <select value={editDebtId} onChange={(e) => setEditDebtId(e.target.value)}>
                    <option value="">No linked debt</option>
                    {debts.map((debt) => (
                      <option key={debt.id} value={debt.id}>
                        {debt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-row">
                  <button type="submit">Save</button>
                  <button type="button" className="btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="list-row-main">
                  <span className="list-row-title">{categoryName(txn.category_id)}</span>
                  <span className="list-row-sub">
                    {txn.txn_date} · {directionLabel(txn.direction)}
                    {accountFlowLabel(txn) ? ` · ${accountFlowLabel(txn)}` : ''}
                  </span>
                </div>
                <div className="subscription-actions">
                  <span className="money">{formatMoney(txn.amount)}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => startEdit(txn)}
                    aria-label="Edit transaction"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleDelete(txn.id)}
                    aria-label="Delete transaction"
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Transactions
