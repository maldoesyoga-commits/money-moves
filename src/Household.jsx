import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import HouseholdInventory from './HouseholdInventory'
import HouseholdManuals from './HouseholdManuals'
import HouseholdMaintenance from './HouseholdMaintenance'
import Meals from './Meals'

const TABS = [
  { to: '/household', label: 'Upkeep', end: true },
  { to: '/household/inventory', label: 'Inventory' },
  { to: '/household/manuals', label: 'Manuals' },
  { to: '/household/meals', label: 'Meals' },
]

function Household() {
  return (
    <section className="household-module">
      <div className="home-greeting">
        <h1>Household</h1>
        <p className="list-row-sub">The house, the stuff in it, and what it needs.</p>
      </div>

      <nav className="segmented-nav">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `segmented-tab${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<HouseholdMaintenance />} />
        <Route path="inventory" element={<HouseholdInventory />} />
        <Route path="manuals" element={<HouseholdManuals />} />
        <Route path="meals/*" element={<Meals />} />
        <Route path="*" element={<Navigate to="/household" replace />} />
      </Routes>
    </section>
  )
}

export default Household
