import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Home from './Home'
import Insights from './Insights'
import Income from './Income'
import Accounts from './Accounts'
import Savings from './Savings'
import Debts from './Debts'
import Transactions from './Transactions'
import More from './More'
import BottomNav from './BottomNav'

const DEFAULT_SETTINGS = {
  weekly_floor: 400,
  tax_pct: 25,
  pay_yourself_pct: 20,
  gst_registered: false,
  statement_day: 1,
}

const DEFAULT_ACCOUNTS = [
  { name: 'RBC Income hub', institution: 'RBC', kind: 'income', sort_order: 0 },
  { name: 'Tax HISA', institution: 'EQ Bank', kind: 'tax', sort_order: 1 },
  { name: 'Everyday Spending', institution: 'RBC', kind: 'spending', sort_order: 2 },
  { name: 'Personal Bills', institution: 'EQ Bank', kind: 'bills', sort_order: 3 },
  { name: 'Sinking Funds', institution: 'EQ Bank', kind: 'sinking', sort_order: 4 },
  { name: 'Emergency Fund', institution: 'EQ Bank', kind: 'emergency', sort_order: 5 },
]

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', category_group: 'Food', bucket: 'need' },
  { name: 'Eating out', category_group: 'Food', bucket: 'want' },
  { name: 'Candy', category_group: 'Food', bucket: 'want' },
  { name: 'Food', category_group: 'Food', bucket: 'need' },
  { name: 'Weed', category_group: 'Substances', bucket: 'want' },
  { name: 'Nicotine', category_group: 'Substances', bucket: 'want' },
  { name: 'Vapes', category_group: 'Substances', bucket: 'want' },
  { name: 'Pets', category_group: 'Pets', bucket: 'need' },
  { name: 'Rent', category_group: 'Housing', bucket: 'need' },
  { name: 'Bills', category_group: 'Bills', bucket: 'need' },
  { name: 'Fun money', category_group: 'Fun', bucket: 'want' },
  { name: 'Life happens', category_group: 'Life', bucket: 'want' },
]

async function seedDefaultsIfFirstRun() {
  const { data: existing, error: selectError } = await supabase
    .from('settings')
    .select('user_id')

  if (selectError) {
    console.error('Failed to check settings for first-run seeding', selectError)
    return
  }

  if (existing && existing.length > 0) return

  const { error: settingsError } = await supabase.from('settings').insert(DEFAULT_SETTINGS)
  if (settingsError) {
    console.error('Failed to seed default settings', settingsError)
    return
  }

  const { error: accountsError } = await supabase.from('accounts').insert(DEFAULT_ACCOUNTS)
  if (accountsError) console.error('Failed to seed default accounts', accountsError)

  const { error: categoriesError } = await supabase.from('categories').insert(DEFAULT_CATEGORIES)
  if (categoriesError) console.error('Failed to seed default categories', categoriesError)

  window.location.reload()
}

function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) seedDefaultsIfFirstRun()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) seedDefaultsIfFirstRun()
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogIn(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (error) setError(error.message)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) setError(error.message)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session) {
    return (
      <div className="app-shell">
        <div className="card">
          <h1>Log in</h1>
          <form>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
            />
            <div className="field-row">
              <button type="submit" disabled={loading} onClick={handleLogIn}>
                Log in
              </button>
              <button
                type="submit"
                className="btn-secondary"
                disabled={loading}
                onClick={handleSignUp}
              >
                Sign up
              </button>
            </div>
          </form>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell app-shell-nav">
      <div className="topbar">
        <p>Logged in as {session.user.email}</p>
        <button type="button" className="btn-secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/income" element={<Income />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

export default App
