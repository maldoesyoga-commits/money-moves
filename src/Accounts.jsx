import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function Accounts() {
  const [accounts, setAccounts] = useState([])

  async function loadAccounts() {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')

    if (error) {
      console.error('Failed to load accounts', error)
      return
    }

    setAccounts(data)
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const total = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)

  return (
    <div className="card">
      <h2>Accounts</h2>
      <div className="total-row">
        <p>Total</p>
        <p className="money">{formatMoney(total)}</p>
      </div>
      <ul className="list">
        {accounts.map((account) => (
          <li key={account.id} className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">{account.name}</span>
            </div>
            <span className="money">{formatMoney(account.balance)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Accounts
