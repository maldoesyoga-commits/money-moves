import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

// Each source: which table, which columns to match, and how to render a hit.
const SOURCES = [
  {
    table: 'tasks',
    columns: ['title', 'notes'],
    group: 'Tasks',
    to: () => '/tasks',
    title: (row) => row.title,
    sub: (row) => [row.status, row.due_date].filter(Boolean).join(' · '),
  },
  {
    table: 'projects',
    columns: ['name', 'description'],
    group: 'Projects',
    to: (row) => `/tasks/projects/${row.id}`,
    title: (row) => row.name,
    sub: (row) => row.description || row.status,
  },
  {
    table: 'plan_entries',
    columns: ['title', 'notes'],
    group: 'Planning',
    to: () => '/planning',
    title: (row) => row.title,
    sub: (row) => `${row.horizon} · ${row.start_date}`,
  },
  {
    table: 'goals',
    columns: ['title', 'notes'],
    group: 'Goals',
    to: () => '/planning',
    title: (row) => row.title,
    sub: (row) => `${row.progress}% · target ${row.target_date || 'none'}`,
  },
  {
    table: 'learning_items',
    columns: ['title', 'author'],
    group: 'Learning',
    to: () => '/learning',
    title: (row) => row.title,
    sub: (row) => `${row.kind} · ${row.progress}%`,
  },
  {
    table: 'content_items',
    columns: ['title', 'hook', 'notes'],
    group: 'Content',
    to: () => '/content',
    title: (row) => row.title,
    sub: (row) => `${row.stage} · ${row.platform}`,
  },
  {
    table: 'clients',
    columns: ['name', 'contact_name', 'email', 'notes'],
    group: 'Clients',
    to: () => '/freelance',
    title: (row) => row.name,
    sub: (row) => row.status,
  },
  {
    table: 'freelance_projects',
    columns: ['name', 'description'],
    group: 'Freelance projects',
    to: () => '/freelance/projects',
    title: (row) => row.name,
    sub: (row) => row.status,
  },
  {
    table: 'invoices',
    columns: ['number', 'notes'],
    group: 'Invoices',
    to: () => '/freelance/invoices',
    title: (row) => row.number || 'Invoice',
    sub: (row) => `${row.status} · ${formatMoney(row.amount)}`,
  },
  {
    table: 'meals',
    columns: ['name', 'ingredients', 'notes'],
    group: 'Meals',
    to: () => '/meals/recipes',
    title: (row) => row.name,
    sub: (row) => `${row.meal_type} · ${row.effort}`,
  },
  {
    table: 'grocery_items',
    columns: ['name'],
    group: 'Groceries',
    to: () => '/meals/groceries',
    title: (row) => row.name,
    sub: (row) => (row.got_it ? 'got it' : row.aisle),
  },
  {
    table: 'notes',
    columns: ['title', 'body'],
    group: 'Notes',
    to: (row) => (row.notebook_id ? `/notes/book/${row.notebook_id}` : '/notes/all'),
    title: (row) => row.title || 'Untitled note',
    sub: (row) => row.category,
  },
  {
    table: 'notebooks',
    columns: ['title', 'description', 'area'],
    group: 'Notebooks',
    to: (row) => `/notes/book/${row.id}`,
    title: (row) => row.title,
    sub: (row) => row.area || 'notebook',
  },
  {
    table: 'journal_entries',
    columns: ['body', 'gratitude'],
    group: 'Journal',
    to: () => '/notes/journal',
    title: (row) => row.entry_date,
    sub: (row) => (row.body || '').slice(0, 70),
  },
  {
    table: 'twy_goals',
    columns: ['title', 'why', 'lag_measure'],
    group: '12 week goals',
    to: () => '/goals/plan',
    title: (row) => row.title,
    sub: (row) => row.lag_measure || 'goal',
  },
  {
    table: 'transactions',
    columns: ['note'],
    group: 'Transactions',
    to: () => '/money/transactions',
    title: (row) => row.note || 'Transaction',
    sub: (row) => `${row.txn_date} · ${formatMoney(row.amount)}`,
  },
]

function Search() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''

  const [draft, setDraft] = useState(query)
  const [groups, setGroups] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setDraft(query)
  }, [query])

  const runSearch = useCallback(async (term) => {
    if (term.trim().length < 2) {
      setGroups([])
      return
    }

    setSearching(true)
    const safe = term.trim().replace(/[%,]/g, ' ')

    const results = await Promise.all(
      SOURCES.map(async (source) => {
        const filter = source.columns.map((column) => `${column}.ilike.%${safe}%`).join(',')

        const { data, error } = await supabase
          .from(source.table)
          .select('*')
          .or(filter)
          .limit(8)

        // A table whose SQL hasn't been run yet just returns nothing.
        if (error) {
          console.log(`Search skipped ${source.table}`, error.message)
          return null
        }

        if (!data || data.length === 0) return null

        return { group: source.group, source, rows: data }
      }),
    )

    setGroups(results.filter(Boolean))
    setSearching(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 200)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  function handleSubmit(e) {
    e.preventDefault()
    setParams(draft.trim() ? { q: draft.trim() } : {})
  }

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0)

  return (
    <section className="search-module">
      <div className="home-greeting">
        <h1>Search</h1>
        <p className="list-row-sub">Everything, everywhere in here.</p>
      </div>

      <div className="card">
        <form className="quick-add" onSubmit={handleSubmit}>
          <input
            type="search"
            className="quick-add-title"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setParams(e.target.value.trim() ? { q: e.target.value } : {}, { replace: true })
            }}
            placeholder="Search tasks, meals, clients, ideas…"
            autoFocus
          />
        </form>

        {query.trim().length < 2 ? (
          <p className="empty-text">Type at least two letters.</p>
        ) : total === 0 ? (
          <p className="empty-text">{searching ? 'Looking…' : `Nothing matches "${query}".`}</p>
        ) : (
          <p className="list-row-sub">
            {total} match{total === 1 ? '' : 'es'}
          </p>
        )}
      </div>

      {groups.map(({ group, source, rows }) => (
        <div className="card" key={group}>
          <div className="project-scope-header">
            <h2>{group}</h2>
            <span className="list-row-sub">{rows.length}</span>
          </div>
          <ul className="list">
            {rows.map((row) => (
              <li key={row.id} className="list-row">
                <div className="list-row-main">
                  <Link to={source.to(row)} className="list-row-title project-link">
                    {source.title(row)}
                  </Link>
                  <span className="list-row-sub">{source.sub(row)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default Search
