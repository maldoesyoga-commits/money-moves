import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import MealPlan from './MealPlan'
import Recipes from './Recipes'
import Groceries from './Groceries'
import Pantry from './Pantry'

const TABS = [
  { to: '/household/meals', label: 'This week', end: true },
  { to: '/household/meals/recipes', label: 'Meals' },
  { to: '/household/meals/pantry', label: 'Pantry' },
  { to: '/household/meals/groceries', label: 'Shopping list' },
]

function Meals() {
  return (
    <section className="meals-module meals-nested">
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
        <Route path="pantry" element={<Pantry />} />
        <Route path="groceries" element={<Groceries />} />
        <Route path="*" element={<Navigate to="/household/meals" replace />} />
      </Routes>
    </section>
  )
}

export default Meals
