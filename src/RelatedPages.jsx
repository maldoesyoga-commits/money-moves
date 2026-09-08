import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { report } from './lib/report'

// Links between pages. A relation is stored once but shows on both pages, so
// linking this page to another makes each show up under the other. `pages` is
// the set you can link to (this notebook's pages); onOpen jumps to one.
function RelatedPages({ noteId, pages, onOpen }) {
  const [relations, setRelations] = useState([])
  const [pick, setPick] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('note_relations')
      .select('*')
      .or(`note_id.eq.${noteId},related_note_id.eq.${noteId}`)

    if (error) {
      report('Failed to load related pages — run supabase/note-relations.sql?', error)
      setRelations([])
      return
    }

    setRelations(data || [])
  }, [noteId])

  useEffect(() => {
    load()
  }, [load])

  const relatedIds = relations.map((r) => (r.note_id === noteId ? r.related_note_id : r.note_id))
  const related = pages.filter((p) => relatedIds.includes(p.id))
  const options = pages.filter((p) => p.id !== noteId && !relatedIds.includes(p.id))

  async function add(e) {
    e.preventDefault()
    if (!pick) return

    const { error } = await supabase
      .from('note_relations')
      .insert({ note_id: noteId, related_note_id: pick })

    if (error) {
      report('Failed to link the page', error)
      return
    }

    setPick('')
    load()
  }

  async function remove(pageId) {
    const rows = relations.filter(
      (r) =>
        (r.note_id === noteId && r.related_note_id === pageId) ||
        (r.related_note_id === noteId && r.note_id === pageId),
    )
    setRelations((prev) => prev.filter((r) => !rows.some((x) => x.id === r.id)))

    for (const r of rows) {
      const { error } = await supabase.from('note_relations').delete().eq('id', r.id)
      if (error) {
        report('Failed to unlink the page', error)
        load()
        return
      }
    }
  }

  return (
    <div
      className="note-attachments"
      style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}
    >
      <div className="budget-row-header">
        <span className="list-row-title">Related pages</span>
        {related.length > 0 && <span className="list-row-sub">{related.length}</span>}
      </div>

      {related.length > 0 && (
        <ul className="list">
          {related.map((p) => (
            <li key={p.id} className="list-row">
              <div className="task-row-body">
                <button
                  type="button"
                  className="list-row-main task-main"
                  onClick={() => onOpen(p.id)}
                  style={{
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <span className="list-row-title project-link">{p.title || 'Untitled'} →</span>
                </button>
                <button
                  type="button"
                  className="row-action-btn row-action-btn-danger"
                  onClick={() => remove(p.id)}
                >
                  Unlink
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 ? (
        <form className="field-row" onSubmit={add}>
          <select className="inline-select" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Link another page…</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || 'Untitled'}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Link
          </button>
        </form>
      ) : (
        related.length === 0 && (
          <p className="list-row-sub">Add more pages to this notebook to link them here.</p>
        )
      )}
    </div>
  )
}

export default RelatedPages
