import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// The one bottom bar in the app — every area, one swipe away. It scrolls like a
// gallery: only ~3–4 tabs show at once, and the bar auto-scrolls so the area
// you're currently in stays in view. Order and icons mirror the hub's grid.
const TABS = [
  { to: '/', label: 'Hub', icon: '🌿', end: true },
  { to: '/money', label: 'Money', icon: '💰' },
  { to: '/tasks', label: 'Tasks', icon: '✅' },
  { to: '/daily', label: 'Daily', icon: '🌅' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/goals', label: 'Goals', icon: '🎯' },
  { to: '/planning', label: 'Planning', icon: '🗓️' },
  { to: '/learning', label: 'Learning', icon: '📚' },
  { to: '/content', label: 'Content', icon: '🎬' },
  { to: '/brand', label: 'Brand', icon: '🎨' },
  { to: '/freelance', label: 'Freelance', icon: '💼' },
  { to: '/cookie-jar', label: 'Jar', icon: '🍪' },
  { to: '/milestones', label: 'Milestones', icon: '🏔️' },
  { to: '/household', label: 'Household', icon: '🏠' },
]

function GlobalNav() {
  const navRef = useRef(null)
  const location = useLocation()

  // Whenever the route changes, bring the active tab into view so the area
  // you're in is never scrolled off the edge of the bar.
  useEffect(() => {
    const active = navRef.current?.querySelector('.bottom-nav-tab.active')
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [location.pathname])

  return (
    <nav className="bottom-nav" ref={navRef}>
      {TABS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-tab${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-emoji" aria-hidden="true">
            {icon}
          </span>
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default GlobalNav
