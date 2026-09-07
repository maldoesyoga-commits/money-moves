import { Link } from 'react-router-dom'

const MODULES = [
  {
    key: 'money',
    icon: '💰',
    name: 'Money Moves',
    tagline: 'Budget, transactions, and insights',
    path: '/money',
    enabled: true,
  },
  {
    key: 'tasks',
    icon: '✅',
    name: 'Tasks & Projects',
    tagline: 'Plan and track your to-dos',
    path: '/tasks',
    enabled: true,
  },
  {
    key: 'planning',
    icon: '🗓️',
    name: 'Planning',
    tagline: 'Calendar and life planning',
    path: '/planning',
    enabled: true,
  },
  {
    key: 'learning',
    icon: '📚',
    name: 'Learning',
    tagline: 'Courses, books, and notes',
    enabled: false,
  },
  {
    key: 'content',
    icon: '🎬',
    name: 'Content',
    tagline: 'Ideas, scripts, and production',
    enabled: false,
  },
  {
    key: 'freelance',
    icon: '💼',
    name: 'Freelance',
    tagline: 'Clients, invoices, and projects',
    enabled: false,
  },
  {
    key: 'meals',
    icon: '🍽️',
    name: 'Meals',
    tagline: 'Recipes and meal planning',
    enabled: false,
  },
]

function HomeHub() {
  return (
    <section className="home-hub">
      <div className="home-greeting">
        <h1>Your hub</h1>
        <p className="list-row-sub">Pick a module to get started.</p>
      </div>

      <div className="module-grid">
        {MODULES.map((mod) =>
          mod.enabled ? (
            <Link key={mod.key} to={mod.path} className="module-card">
              <span className="module-card-icon">{mod.icon}</span>
              <span className="module-card-name">{mod.name}</span>
              <span className="module-card-tagline">{mod.tagline}</span>
            </Link>
          ) : (
            <div key={mod.key} className="module-card module-card-disabled" aria-disabled="true">
              <span className="module-card-badge">Coming soon</span>
              <span className="module-card-icon">{mod.icon}</span>
              <span className="module-card-name">{mod.name}</span>
              <span className="module-card-tagline">{mod.tagline}</span>
            </div>
          ),
        )}
      </div>
    </section>
  )
}

export default HomeHub
