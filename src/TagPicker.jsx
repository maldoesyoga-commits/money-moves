import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// Attach/detach tags on any row, in any module.
// Usage: <TagPicker table="tasks" id={task.id} />
function TagPicker({ table, id }) {
  const [tags, setTags] = useState([])
  const [mine, setMine] = useState([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const loadTags = useCallback(async () => {
    const { data, error } = await supabase.from('tags').select('*').order('name')

    if (error) {
      console.log('Failed to load tags', error.message)
      return
    }

    setTags(data)
  }, [])

  const loadMine = useCallback(async () => {
    const { data, error } = await supabase
      .from('taggings')
      .select('*')
      .eq('item_table', table)
      .eq('item_id', id)

    if (error) {
      console.log('Failed to load taggings', error.message)
      return
    }

    setMine(data)
  }, [table, id])

  useEffect(() => {
    loadTags()
    loadMine()
  }, [loadTags, loadMine])

  async function attach(tagId) {
    const { error } = await supabase
      .from('taggings')
      .insert({ tag_id: tagId, item_table: table, item_id: id })

    if (error) {
      console.log('Failed to attach tag', error.message)
      return
    }

    loadMine()
  }

  async function detach(taggingId) {
    setMine((prev) => prev.filter((row) => row.id !== taggingId))

    const { error } = await supabase.from('taggings').delete().eq('id', taggingId)

    if (error) {
      console.log('Failed to remove tag', error.message)
      loadMine()
    }
  }

  async function createAndAttach(e) {
    e.preventDefault()

    const name = draft.trim().toLowerCase()
    if (!name) return

    const existing = tags.find((tag) => tag.name === name)

    if (existing) {
      await attach(existing.id)
    } else {
      const { data, error } = await supabase.from('tags').insert({ name }).select().single()

      if (error) {
        console.log('Failed to create tag', error.message)
        return
      }

      await attach(data.id)
      loadTags()
    }

    setDraft('')
    setAdding(false)
  }

  const attached = mine
    .map((row) => ({ tagging: row, tag: tags.find((tag) => tag.id === row.tag_id) }))
    .filter((row) => row.tag)

  const unattached = tags.filter((tag) => !mine.some((row) => row.tag_id === tag.id))

  return (
    <div className="tag-picker">
      {attached.map(({ tagging, tag }) => (
        <button
          key={tagging.id}
          type="button"
          className="tag-chip attached"
          onClick={() => detach(tagging.id)}
          title="Remove tag"
        >
          #{tag.name} ×
        </button>
      ))}

      {adding ? (
        <form className="tag-add-form" onSubmit={createAndAttach}>
          <input
            type="text"
            list={`tags-${table}-${id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="tag name"
            autoFocus
            onBlur={() => !draft && setAdding(false)}
          />
          <datalist id={`tags-${table}-${id}`}>
            {unattached.map((tag) => (
              <option key={tag.id} value={tag.name} />
            ))}
          </datalist>
        </form>
      ) : (
        <button type="button" className="tag-chip add" onClick={() => setAdding(true)}>
          + tag
        </button>
      )}
    </div>
  )
}

export default TagPicker
