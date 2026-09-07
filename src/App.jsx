import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { HomeIcon, SearchIcon } from './icons'
import HomeHub from './HomeHub'
import MoneyMoves from './MoneyMoves'
import Tasks from './Tasks'
import Planning from './Planning'
import Learning from './Learning'
import Content from './Content'
import Freelance from './Freelance'
import Meals from './Meals'
import Search from './Search'
import Backup from './Backup'
import Notes from './Notes'
import Daily from './Daily'
import Goals from './Goals'
import Tags from './Tags'
import Review from './Review'
import GlobalNav from './GlobalNav'
import ThemeToggle from './ThemeToggle'
import QuickCapture from './QuickCapture'
import ErrorToast from './ErrorToast'

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
    report('Failed to check settings for first-run seeding', selectError)
    return
  }

  if (existing && existing.length > 0) return

  const { error: settingsError } = await supabase.from('settings').insert(DEFAULT_SETTINGS)
  if (settingsError) {
    report('Failed to seed default settings', settingsError)
    return
  }

  const { error: accountsError } = await supabase.from('accounts').insert(DEFAULT_ACCOUNTS)
  if (accountsError) report('Failed to seed default accounts', accountsError)

  const { error: categoriesError } = await supabase.from('categories').insert(DEFAULT_CATEGORIES)
  if (categoriesError) report('Failed to seed default categories', categoriesError)

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
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-left">
          <Link to="/" className="icon-button" aria-label="Back to hub">
            <HomeIcon className="bottom-nav-icon" />
          </Link>
          <Link to="/search" className="icon-button" aria-label="Search">
            <SearchIcon className="bottom-nav-icon" />
          </Link>
          <p>Logged in as {session.user.email}</p>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
      <Routes>
        <Route path="/" element={<HomeHub />} />
        <Route path="/money/*" element={<MoneyMoves />} />
        <Route path="/tasks/*" element={<Tasks />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/content" element={<Content />} />
        <Route path="/freelance/*" element={<Freelance />} />
        <Route path="/meals/*" element={<Meals />} />
        <Route path="/search" element={<Search />} />
        <Route path="/notes/*" element={<Notes />} />
        <Route path="/daily/*" element={<Daily />} />
        <Route path="/goals/*" element={<Goals />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/review" element={<Review />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <QuickCapture />
      <GlobalNav />
      <ErrorToast />
    </div>
  )
}

export default App
