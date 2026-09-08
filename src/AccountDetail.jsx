import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function AccountDetail() {
  const { accountId } = useParams()

  const [account, setAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [subs, setSubs] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const [acc, txn, cat, sub] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase
        .from('transactions')
        .select('*')
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .order('txn_date', { ascending: false }),
      supabase.from('categories').select('id, name'),
      supabase.from('subscriptions').select('*').eq('account_id', accountId),
    ])
    if (acc.data) setAccount(acc.data)
    if (txn.data) setTransactions(txn.data)
    if (cat.data) setCategories(cat.data)
    if (sub.data) setSubs(sub.data)
    setLoaded(true)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  function categoryName(id) {
    return categories.find((c) => c.id === id)?.name || 'Uncategorized'
  }

  // Amount as it affects THIS account: money to it is positive, from it negative.
  function signedAmount(txn) {
    const amt = Number(txn.amount || 0)
    if (txn.to_account_id === accountId && txn.from_account_id === accountId) return 0
    if (txn.to_account_id === accountId) return amt
    return -amt
  }

  return (
    <div className="money-page">
      <div className="card">
        <p className="list-row-sub">
          <Link to="/money/accounts" className="project-link">
            ← All accounts
          </Link>
        </p>

        {!account && loaded ? (
          <p className="empty-text">Account not found.</p>
        ) : (
          <>
            <div className="project-scope-header">
              <h2>{account?.name || 'Account'}</h2>
              <span className="money">{formatMoney(account?.balance)}</span>
            </div>
            {account?.institution && <p className="list-row-sub">{account.institution}</p>}

            {subs.length > 0 && (
              <p className="list-row-sub account-subs">
                Subscriptions: {subs.map((s) => s.name).join(', ')}
              </p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Transactions</h2>
          <span className="list-row-sub">{transactions.length}</span>
        </div>
        {transactions.length === 0 ? (
          <p className="empty-text">No transactions for this account yet.</p>
        ) : (
          <ul className="list">
            {transactions.map((txn) => {
              const signed = signedAmount(txn)
              return (
                <li key={txn.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">
                      {txn.note || categoryName(txn.category_id)}
                    </span>
                    <span className="list-row-sub">
                      {txn.txn_date}
                      {txn.direction === 'transfer' ? ' · transfer' : ''}
                    </span>
                  </div>
                  <span className={signed >= 0 ? 'amount-in' : 'amount-out'}>
                    {signed >= 0 ? '+' : '-'}
                    {formatMoney(Math.abs(signed))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AccountDetail
