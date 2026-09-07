import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import MealPlan from './MealPlan'
import Recipes from './Recipes'
import Groceries from './Groceries'

const TABS = [
  { to: '/meals', label: 'This week', end: true },
  { to: '/meals/recipes', label: 'Meals' },
  { to: '/meals/groceries', label: 'Groceries' },
]

function Meals() {
  return (
    <section className="meals-module">
      <div className="home-greeting">
        <h1>Meals</h1>
        <p className="list-row-sub">Decide once, shop once.</p>
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
        <Route path="/" element={<MealPlan />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="groceries" element={<Groceries />} />
        <Route path="*" element={<Navigate to="/meals" replace />} />
      </Routes>
    </section>
  )
}

export default Meals
