import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function Income() {
  const [settings, setSettings] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [grossAmount, setGrossAmount] = useState('')
  const [source, setSource] = useState('')
  const [bills, setBills] = useState('')
  const [sinking, setSinking] = useState('')
  const [emergency, setEmergency] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSettings() {
    const { data, error } = await supabase.from('settings').select('*').single()

    if (error) {
      console.error('Failed to load settings', error)
      return
    }

    setSettings(data)
  }

  async function loadAccounts() {
    const { data, error } = await supabase.from('accounts').select('*')

    if (error) {
      console.error('Failed to load accounts', error)
      return
    }

    setAccounts(data)
  }

  useEffect(() => {
    loadSettings()
    loadAccounts()
  }, [])

  const taxPct = settings ? Number(settings.tax_pct) || 0 : 0
  const gross = Number(grossAmount) || 0
  const billsAmount = Number(bills) || 0
  const sinkingAmount = Number(sinking) || 0
  const emergencyAmount = Number(emergency) || 0

  const taxAmount = (gross * taxPct) / 100
  const net = gross - taxAmount
  const everydayAmount = net - billsAmount - sinkingAmount - emergencyAmount

  const splits = [
    { label: 'Tax HISA', amount: taxAmount },
    { label: 'Personal Bills', amount: billsAmount },
    { label: 'Sinking Funds', amount: sinkingAmount },
    { label: 'Emergency Fund', amount: emergencyAmount },
    { label: 'Everyday Spending', amount: everydayAmount },
  ]

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    const { error: insertError } = await supabase.from('income_events').insert({
      gross_amount: gross,
      source,
      tax_pct: taxPct,
      tax_amount: taxAmount,
      net_amount: net,
      splits,
    })

    if (insertError) {
      console.error('Failed to save income event', insertError)
      setSaving(false)
      return
    }

    for (const split of splits) {
      const account = accounts.find((a) => a.name === split.label)
      if (!account) continue

      const { error: updateError } = await supabase
        .from('accounts')
        .update({ balance: Number(account.balance || 0) + split.amount })
        .eq('id', account.id)

      if (updateError) console.error(`Failed to update balance for ${split.label}`, updateError)
    }

    setSaving(false)
    window.location.reload()
  }

  return (
    <div className="card">
      <h2>Income</h2>
      <form onSubmit={handleSave}>
        <div className="field-row">
          <input
            type="number"
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
            placeholder="gross amount"
            required
          />
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="source (optional)"
          />
        </div>
        <div className="field-row">
          <label>
            Personal Bills
            <input type="number" value={bills} onChange={(e) => setBills(e.target.value)} />
          </label>
          <label>
            Sinking Funds
            <input type="number" value={sinking} onChange={(e) => setSinking(e.target.value)} />
          </label>
          <label>
            Emergency Fund
            <input
              type="number"
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
            />
          </label>
        </div>

        <h3>Transfers to make</h3>
        <ul className="transfers-list">
          {splits.map((split) => (
            <li key={split.label}>
              Move <span className="money">{formatMoney(split.amount)}</span> to {split.label}
            </li>
          ))}
        </ul>

        <button type="submit" disabled={saving}>
          Save this income
        </button>
      </form>
    </div>
  )
}

export default Income
