import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { effectDeltas, mergeDeltaLists, applyBalanceDeltas } from './lib/balances'
import { usePeriod } from './usePeriod'
import PeriodSelector from './PeriodSelector'

function directionLabel(direction) {
  if (direction === 'in') return 'In'
  if (direction === 'transfer') return 'Transfer'
  return 'Out'
}

function extensionFromFile(file) {
  const nameParts = file.name.split('.')
  if (nameParts.length > 1) return nameParts.pop().toLowerCase()
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

// Insert (or clear) the auto "draw" debt entry that mirrors a from-a-debt
// transaction, so borrowing shows up on the debt. Linked by transaction_id.
async function syncDebtDraw(txnId, fromDebtId, amount) {
  await supabase.from('debt_entries').delete().eq('transaction_id', txnId)
  if (fromDebtId) {
    await supabase.from('debt_entries').insert({
      debt_id: fromDebtId,
      amount: Number(amount) || 0,
      direction: 'draw',
      transaction_id: txnId,
    })
  }
}

function Transactions() {
  const { period } = usePeriod()

  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [debtId, setDebtId] = useState('')
  const [direction, setDirection] = useState('out')
  const [fromAccountId, setFromAccountId] = useState('')
  const [fromDebtId, setFromDebtId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [addError, setAddError] = useState(null)

  const [onlyUncategorized, setOnlyUncategorized] = useState(false)
  const [flashId, setFlashId] = useState(null)

  const [receiptsByTxn, setReceiptsByTxn] = useState({})
  const [uploadingReceiptId, setUploadingReceiptId] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editDebtId, setEditDebtId] = useState('')
  const [editDirection, setEditDirection] = useState('out')
  const [editFromAccountId, setEditFromAccountId] = useState('')
  const [editFromDebtId, setEditFromDebtId] = useState('')
  const [editToAccountId, setEditToAccountId] = useState('')
  const [editError, setEditError] = useState(null)
  const [quickDebtId, setQuickDebtId] = useState('')

  async function loadTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('txn_date', { ascending: false })
    if (error) {
      console.log('Failed to load transactions', error.message)
      return
    }
    setTransactions(data)
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or('archived.is.null,archived.eq.false')
    if (error) {
      console.log('Failed to load categories', error.message)
      return
    }
    setCategories(data)
    if (data && data.length > 0) setCategoryId(data[0].id)
  }

  async function loadDebts() {
    const { data, error } = await supabase.from('debts').select('*')
    if (!error && data) setDebts(data)
  }

  async function loadAccounts() {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')
    if (!error && data) setAccounts(data)
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

  // "From" combines accounts and (for spends) debts, encoded as acct:<id> / debt:<id>.
  function fromValue(acctId, debtIdValue) {
    if (debtIdValue) return `debt:${debtIdValue}`
    if (acctId) return `acct:${acctId}`
    return ''
  }
  function applyFromValue(value, setAcct, setDebt) {
    if (value.startsWith('debt:')) {
      setDebt(value.slice(5))
      setAcct('')
    } else if (value.startsWith('acct:')) {
      setAcct(value.slice(5))
      setDebt('')
    } else {
      setAcct('')
      setDebt('')
    }
  }

  function FromSelect({ value, onChange, forDirection, requiredTransfer }) {
    return (
      <select value={value} onChange={onChange} required={requiredTransfer}>
        <option value="">From —</option>
        <optgroup label="Accounts">
          {accounts.map((account) => (
            <option key={account.id} value={`acct:${account.id}`}>
              {account.name}
            </option>
          ))}
        </optgroup>
        {forDirection === 'out' && debts.length > 0 && (
          <optgroup label="Borrow from (debt)">
            {debts.map((debt) => (
              <option key={debt.id} value={`debt:${debt.id}`}>
                {debt.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    )
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAddError(null)

    if (direction === 'transfer' && (!fromAccountId || !toAccountId)) {
      setAddError('Transfers need both a from account and a to account.')
      return
    }

    const payload = {
      amount: Number(amount),
      category_id: categoryId || null,
      direction,
      from_account_id: fromAccountId || null,
      to_account_id: toAccountId || null,
    }
    if (debtId) payload.debt_id = debtId
    if (fromDebtId && direction === 'out') payload.from_debt_id = fromDebtId

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select()
      .single()
    if (error) {
      console.log(error.message)
      return
    }

    await applyBalanceDeltas(mergeDeltaLists(effectDeltas(inserted, 1)))
    if (inserted.from_debt_id) await syncDebtDraw(inserted.id, inserted.from_debt_id, inserted.amount)

    setAmount('')
    setDebtId('')
    setFromAccountId('')
    setFromDebtId('')
    setToAccountId('')
    loadTransactions()
  }

  function flashRow(id) {
    setFlashId(id)
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), 900)
  }

  async function handleInlineCategoryChange(id, nextCategoryId) {
    const value = nextCategoryId || null
    const previous = transactions.find((t) => t.id === id)?.category_id ?? null
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, category_id: value } : t)))
    const { error } = await supabase.from('transactions').update({ category_id: value }).eq('id', id)
    if (error) {
      console.log(error.message)
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, category_id: previous } : t)))
      return
    }
    flashRow(id)
  }

  async function handleInlineDirectionChange(id, newDirection) {
    const { data: oldTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) {
      console.log(fetchError.message)
      return
    }
    if (oldTxn.direction === newDirection) return

    const newTxn = { ...oldTxn, direction: newDirection }
    const balancesOk = await applyBalanceDeltas(
      mergeDeltaLists(effectDeltas(oldTxn, -1), effectDeltas(newTxn, 1)),
    )
    if (!balancesOk) return

    const { error: updateError } = await supabase
      .from('transactions')
      .update({ direction: newDirection })
      .eq('id', id)
    if (updateError) {
      console.log(updateError.message)
      return
    }
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, direction: newDirection } : t)))
    flashRow(id)
  }

  function startEdit(txn) {
    setEditingId(txn.id)
    setEditDate(txn.txn_date || '')
    setEditAmount(String(txn.amount ?? ''))
    setEditCategoryId(txn.category_id || '')
    setEditDebtId(txn.debt_id || '')
    setEditDirection(txn.direction || 'out')
    setEditFromAccountId(txn.from_account_id || '')
    setEditFromDebtId(txn.from_debt_id || '')
    setEditToAccountId(txn.to_account_id || '')
    setEditError(null)
    setQuickDebtId('')
    loadReceiptsForTxn(txn.id)
  }

  async function loadReceiptsForTxn(txnId) {
    const { data, error } = await supabase.from('documents').select('*').eq('transaction_id', txnId)
    if (error) {
      console.log('Failed to load receipts', error.message)
      return
    }
    const withUrls = await Promise.all(
      (data || []).map(async (doc) => {
        const { data: signed, error: signError } = await supabase.storage
          .from('receipts')
          .createSignedUrl(doc.storage_path, 3600)
        if (signError) return { ...doc, url: null }
        return { ...doc, url: signed.signedUrl }
      }),
    )
    setReceiptsByTxn((prev) => ({ ...prev, [txnId]: withUrls }))
  }

  async function handleAddReceipt(txn, file) {
    if (!file) return
    setUploadingReceiptId(txn.id)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      console.log(userError ? userError.message : 'No authenticated user')
      setUploadingReceiptId(null)
      return
    }

    const ext = extensionFromFile(file)
    const path = `${userData.user.id}/${crypto.randomUUID()}.${ext}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(path, file)
    if (uploadError) {
      console.log(uploadError.message)
      setUploadingReceiptId(null)
      return
    }

    const { error: insertError } = await supabase.from('documents').insert({
      kind: 'receipt',
      storage_path: uploadData.path,
      transaction_id: txn.id,
      doc_date: txn.txn_date,
      amount: txn.amount,
    })
    if (insertError) {
      console.log(insertError.message)
      setUploadingReceiptId(null)
      return
    }

    await loadReceiptsForTxn(txn.id)
    setUploadingReceiptId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
    setQuickDebtId('')
  }

  async function handleSaveEdit(e, id) {
    e.preventDefault()
    setEditError(null)

    if (editDirection === 'transfer' && (!editFromAccountId || !editToAccountId)) {
      setEditError('Transfers need both a from account and a to account.')
      return
    }

    const { data: oldTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) {
      console.log(fetchError.message)
      return
    }

    const nextFromDebtId = editDirection === 'out' ? editFromDebtId || null : null

    const newTxn = {
      txn_date: editDate,
      amount: Number(editAmount),
      category_id: editCategoryId || null,
      debt_id: editDebtId || null,
      direction: editDirection,
      from_account_id: editFromAccountId || null,
      from_debt_id: nextFromDebtId,
      to_account_id: editToAccountId || null,
    }

    const balancesOk = await applyBalanceDeltas(
      mergeDeltaLists(effectDeltas(oldTxn, -1), effectDeltas(newTxn, 1)),
    )
    if (!balancesOk) return

    const { error: updateError } = await supabase.from('transactions').update(newTxn).eq('id', id)
    if (updateError) {
      console.log(updateError.message)
      return
    }

    await syncDebtDraw(id, nextFromDebtId, newTxn.amount)

    setEditingId(null)
    loadTransactions()
  }

  async function handleMarkAsDebtPayment(txn, debtIdToUse) {
    if (!debtIdToUse) return
    const { data: oldTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', txn.id)
      .single()
    if (fetchError) {
      console.log(fetchError.message)
      return
    }
    const newTxn = { ...oldTxn, direction: 'out', debt_id: debtIdToUse }
    const balancesOk = await applyBalanceDeltas(
      mergeDeltaLists(effectDeltas(oldTxn, -1), effectDeltas(newTxn, 1)),
    )
    if (!balancesOk) return
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ direction: 'out', debt_id: debtIdToUse })
      .eq('id', txn.id)
    if (updateError) {
      console.log(updateError.message)
      return
    }
    setEditingId(null)
    setQuickDebtId('')
    loadTransactions()
  }

  async function handleMarkAsBorrowed(txn, debtIdToUse) {
    if (!debtIdToUse) return
    const { data: oldTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', txn.id)
      .single()
    if (fetchError) {
      console.log(fetchError.message)
      return
    }
    const newTxn = { ...oldTxn, direction: 'in', debt_id: debtIdToUse }
    const balancesOk = await applyBalanceDeltas(
      mergeDeltaLists(effectDeltas(oldTxn, -1), effectDeltas(newTxn, 1)),
    )
    if (!balancesOk) return
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ direction: 'in', debt_id: debtIdToUse })
      .eq('id', txn.id)
    if (updateError) {
      console.log(updateError.message)
      return
    }
    const { error: entryError } = await supabase.from('debt_entries').insert({
      debt_id: debtIdToUse,
      amount: Number(oldTxn.amount) || 0,
      direction: 'draw',
    })
    if (entryError) {
      console.log(entryError.message)
      return
    }
    setEditingId(null)
    setQuickDebtId('')
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

    const balancesOk = await applyBalanceDeltas(mergeDeltaLists(effectDeltas(oldTxn, -1)))
    if (!balancesOk) return

    // remove any auto-draw this transaction created on a debt
    await supabase.from('debt_entries').delete().eq('transaction_id', id)

    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id)
    if (deleteError) {
      console.log(deleteError.message)
      return
    }
    if (editingId === id) setEditingId(null)
    loadTransactions()
  }

  function accountName(accountId) {
    return accounts.find((a) => a.id === accountId)?.name || ''
  }
  function debtName(id) {
    return debts.find((d) => d.id === id)?.name || 'debt'
  }

  function accountFlowLabel(txn) {
    const from = accountName(txn.from_account_id)
    const to = accountName(txn.to_account_id)
    if (txn.direction === 'transfer' && from && to) return `${from} → ${to}`
    if (txn.direction === 'out' && txn.from_debt_id) return `from ${debtName(txn.from_debt_id)}`
    if (txn.direction === 'out' && from) return `from ${from}`
    if (txn.direction === 'in' && to) return `to ${to}`
    return ''
  }

  const periodTransactions = transactions.filter(
    (txn) => txn.txn_date >= period.startKey && txn.txn_date <= period.endKey,
  )
  const uncategorizedCount = periodTransactions.filter((txn) => !txn.category_id).length
  const visibleTransactions = onlyUncategorized
    ? periodTransactions.filter((txn) => !txn.category_id)
    : periodTransactions

  return (
    <div className="card">
      <h2>Transactions</h2>

      <PeriodSelector />

      <form className="money-form" onSubmit={handleAdd}>
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
          <FromSelect
            value={fromValue(fromAccountId, fromDebtId)}
            onChange={(e) => applyFromValue(e.target.value, setFromAccountId, setFromDebtId)}
            forDirection={direction}
            requiredTransfer={direction === 'transfer'}
          />
          <select
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            required={direction === 'transfer'}
          >
            <option value="">To account —</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        {direction === 'transfer' && (
          <p className="list-row-sub">Transfers need both a from account and a to account.</p>
        )}
        {fromDebtId && direction === 'out' && (
          <p className="list-row-sub">This adds {formatMoney(Number(amount) || 0)} to {debtName(fromDebtId)}.</p>
        )}
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
        {addError && <p className="error-text">{addError}</p>}
        <button type="submit">Add</button>
      </form>

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={onlyUncategorized}
            onChange={(e) => setOnlyUncategorized(e.target.checked)}
          />
          Needs a category
        </label>
        {uncategorizedCount > 0 && <span className="list-row-sub">{uncategorizedCount} untagged</span>}
      </div>

      <ul className="list">
        {visibleTransactions.map((txn) => (
          <li
            key={txn.id}
            className={`list-row transaction-row${flashId === txn.id ? ' row-flash-saved' : ''}`}
          >
            {editingId === txn.id ? (
              <form className="transaction-edit-form" onSubmit={(e) => handleSaveEdit(e, txn.id)}>
                <div className="field-row">
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
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
                  <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                    <option value="">—</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <FromSelect
                    value={fromValue(editFromAccountId, editFromDebtId)}
                    onChange={(e) => applyFromValue(e.target.value, setEditFromAccountId, setEditFromDebtId)}
                    forDirection={editDirection}
                    requiredTransfer={editDirection === 'transfer'}
                  />
                  <select
                    value={editToAccountId}
                    onChange={(e) => setEditToAccountId(e.target.value)}
                    required={editDirection === 'transfer'}
                  >
                    <option value="">To account —</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                {editDirection === 'transfer' && (
                  <p className="list-row-sub">Transfers need both a from account and a to account.</p>
                )}
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

                {debts.length > 0 && (
                  <div className="debt-quick-actions">
                    <label>
                      Debt quick action
                      <select value={quickDebtId} onChange={(e) => setQuickDebtId(e.target.value)}>
                        <option value="">Choose a debt —</option>
                        {debts.map((debt) => (
                          <option key={debt.id} value={debt.id}>
                            {debt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="field-row">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!quickDebtId}
                        onClick={() => handleMarkAsDebtPayment(txn, quickDebtId)}
                      >
                        This is a payment to a debt
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!quickDebtId}
                        onClick={() => handleMarkAsBorrowed(txn, quickDebtId)}
                      >
                        This is money borrowed
                      </button>
                    </div>
                  </div>
                )}

                <label>
                  Add receipt
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      handleAddReceipt(txn, file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {uploadingReceiptId === txn.id && <p className="list-row-sub">Uploading…</p>}
                {receiptsByTxn[txn.id]?.length > 0 && (
                  <div className="receipt-thumb-row">
                    {receiptsByTxn[txn.id].map((doc) =>
                      doc.url ? (
                        <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="receipt-thumb-link">
                          <img src={doc.url} alt="Receipt" className="receipt-thumb" />
                        </a>
                      ) : (
                        <span key={doc.id} className="list-row-sub">
                          Preview unavailable
                        </span>
                      ),
                    )}
                  </div>
                )}
                {editError && <p className="error-text">{editError}</p>}
                <div className="field-row">
                  <button type="submit">Save</button>
                  <button type="button" className="btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="transaction-row-body">
                <div className="list-row-main">
                  <span className="list-row-title">{txn.note || 'No description'}</span>
                  <span className="list-row-sub">
                    {txn.txn_date} · {directionLabel(txn.direction)}
                    {accountFlowLabel(txn) ? ` · ${accountFlowLabel(txn)}` : ''}
                  </span>
                </div>
                <div className="transaction-controls">
                  <select
                    className="inline-select"
                    value={txn.category_id || ''}
                    onChange={(e) => handleInlineCategoryChange(txn.id, e.target.value)}
                    aria-label="Category"
                  >
                    <option value="">— category —</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <div className="direction-toggle compact">
                    <button
                      type="button"
                      className={`direction-btn direction-out${txn.direction === 'out' ? ' active' : ''}`}
                      onClick={() => handleInlineDirectionChange(txn.id, 'out')}
                    >
                      Out
                    </button>
                    <button
                      type="button"
                      className={`direction-btn direction-in${txn.direction === 'in' ? ' active' : ''}`}
                      onClick={() => handleInlineDirectionChange(txn.id, 'in')}
                    >
                      In
                    </button>
                  </div>
                  <span className="money">{formatMoney(txn.amount)}</span>
                  <button type="button" className="icon-button" onClick={() => startEdit(txn)} aria-label="Edit transaction">
                    ✎
                  </button>
                  <button type="button" className="icon-button" onClick={() => handleDelete(txn.id)} aria-label="Delete transaction">
                    ×
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Transactions
