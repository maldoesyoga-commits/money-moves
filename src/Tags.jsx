import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'

// How to display a tagged row from each table.
const SOURCES = {
  tasks: { group: 'Tasks', to: () => '/tasks', title: (r) => r.title, sub: (r) => r.status },
  projects: {
    group: 'Projects',
    to: (r) => `/tasks/projects/${r.id}`,
    title: (r) => r.name,
    sub: (r) => r.status,
  },
  notes: { group: 'Notes', to: () => '/notes', title: (r) => r.title || 'Untitled', sub: (r) => r.category },
  content_items: {
    group: 'Content',
    to: () => '/content',
    title: (r) => r.title,
    sub: (r) => `${r.stage} · ${r.platform}`,
  },
  clients: { group: 'Clients', to: () => '/freelance', title: (r) => r.name, sub: (r) => r.status },
  freelance_projects: {
    group: 'Freelance projects',
    to: () => '/freelance/projects',
    title: (r) => r.name,
    sub: (r) => r.status,
  },
  learning_items: {
    group: 'Learning',
    to: () => '/learning',
    title: (r) => r.title,
    sub: (r) => `${r.kind} · ${r.progress}%`,
  },
  meals: { group: 'Meals', to: () => '/meals/recipes', title: (r) => r.name, sub: (r) => r.meal_type },
  goals: { group: 'Goals', to: () => '/planning', title: (r) => r.title, sub: (r) => `${r.progress}%` },
}

function Tags() {
  const [tags, setTags] = useState([])
  const [counts, setCounts] = useState({})
  const [selected, setSelected] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [newTag, setNewTag] = useState('')

  const loadTags = useCallback(async () => {
    const { data, error } = await supabase.from('tags').select('*').order('name')

    if (error) {
      console.log('Failed to load tags', error.message)
      return
    }

    setTags(data)

    const { data: taggings, error: tagError } = await supabase.from('taggings').select('tag_id')

    if (tagError) return

    const next = {}
    taggings.forEach((row) => {
      next[row.tag_id] = (next[row.tag_id] || 0) + 1
    })
    setCounts(next)
  }, [])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  const openTag = useCallback(async (tag) => {
    setSelected(tag)
    setLoading(true)

    const { data: taggings, error } = await supabase
      .from('taggings')
      .select('*')
      .eq('tag_id', tag.id)

    if (error) {
      console.log('Failed to load tagged items', error.message)
      setLoading(false)
      return
    }

    // Group the ids by table, then one query per table.
    const byTable = {}
    taggings.forEach((row) => {
      byTable[row.item_table] = byTable[row.item_table] || []
      byTable[row.item_table].push(row.item_id)
    })

    const results = await Promise.all(
      Object.entries(byTable).map(async ([table, ids]) => {
        const { data, error: rowError } = await supabase.from(table).select('*').in('id', ids)

        if (rowError || !data || data.length === 0) return null
        return { table, rows: data }
      }),
    )

    setGroups(results.filter(Boolean))
    setLoading(false)
  }, [])

  async function createTag(e) {
    e.preventDefault()

    const name = newTag.trim().toLowerCase()
    if (!name) return

    const { error } = await supabase.from('tags').insert({ name })

    if (error) {
      console.log('Failed to create tag', error.message)
      return
    }

    setNewTag('')
    loadTags()
  }

  async function deleteTag(tag) {
    setTags((prev) => prev.filter((row) => row.id !== tag.id))
    if (selected?.id === tag.id) setSelected(null)

    const { error } = await supabase.from('tags').delete().eq('id', tag.id)

    if (error) {
      console.log('Failed to delete tag', error.message)
      loadTags()
    }
  }

  return (
    <section className="tags-module">
      <div className="home-greeting">
        <h1>Tags</h1>
        <p className="list-row-sub">One thread through everything.</p>
      </div>

      <div className="card">
        <form className="field-row" onSubmit={createTag}>
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="new tag name"
          />
          <button type="submit">Add tag</button>
        </form>

        {tags.length === 0 ? (
          <EmptyState icon="🏷️" title="No tags yet">
            Tags cut across modules — put <strong>#launch</strong> on a task, a content
            idea and a note, and this page shows all three together. Add one from the
            Edit panel of anything.
          </EmptyState>
        ) : (
          <div className="tag-cloud">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip${selected?.id === tag.id ? ' attached' : ''}`}
                onClick={() => openTag(tag)}
              >
                #{tag.name}
                <span className="tag-count">{counts[tag.id] || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="card">
            <div className="project-scope-header">
              <h2>#{selected.name}</h2>
              <button
                type="button"
                className="row-action-btn row-action-btn-danger"
                onClick={() => deleteTag(selected)}
              >
                Delete tag
              </button>
            </div>
            {loading && <p className="empty-text">Looking…</p>}
            {!loading && groups.length === 0 && (
              <p className="empty-text">Nothing tagged #{selected.name} yet.</p>
            )}
          </div>

          {groups.map(({ table, rows }) => {
            const source = SOURCES[table]
            if (!source) return null

            return (
              <div className="card" key={table}>
                <div className="project-scope-header">
                  <h2>{source.group}</h2>
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
            )
          })}
        </>
      )}
    </section>
  )
}

export default Tags
