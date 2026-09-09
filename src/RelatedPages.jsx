import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'

// Links between notes, across the whole system. A relation is stored once but
// shows on both notes, so linking A to B makes each show up under the other.
// You can relate to any note, in any notebook (or none).
function RelatedPages({ noteId }) {
  const [relations, setRelations] = useState([])
  const [notes, setNotes] = useState([])
  const [notebooks, setNotebooks] = useState([])
  const [pick, setPick] = useState('')

  const load = useCallback(async () => {
    const [{ data: rels, error: relError }, { data: noteRows }, { data: bookRows }] =
      await Promise.all([
        supabase
          .from('note_relations')
          .select('*')
          .or(`note_id.eq.${noteId},related_note_id.eq.${noteId}`),
        supabase.from('notes').select('id, title, notebook_id').order('title'),
        supabase.from('notebooks').select('id, title'),
      ])

    if (relError) {
      report('Failed to load related pages — run supabase/note-relations.sql?', relError)
      setRelations([])
      return
    }

    setRelations(rels || [])
    setNotes(noteRows || [])
    setNotebooks(bookRows || [])
  }, [noteId])

  useEffect(() => {
    load()
  }, [load])

  function bookName(id) {
    return notebooks.find((b) => b.id === id)?.title || 'No notebook'
  }

  const relatedIds = relations.map((r) => (r.note_id === noteId ? r.related_note_id : r.note_id))
  const related = notes.filter((n) => relatedIds.includes(n.id))
  const options = notes.filter((n) => n.id !== noteId && !relatedIds.includes(n.id))

  async function add(e) {
    e.preventDefault()
    if (!pick) return

    const { error } = await supabase
      .from('note_relations')
      .insert({ note_id: noteId, related_note_id: pick })

    if (error) {
      report('Failed to link the note', error)
      return
    }

    setPick('')
    load()
  }

  async function remove(otherId) {
    const rows = relations.filter(
      (r) =>
        (r.note_id === noteId && r.related_note_id === otherId) ||
        (r.related_note_id === noteId && r.note_id === otherId),
    )
    setRelations((prev) => prev.filter((r) => !rows.some((x) => x.id === r.id)))

    for (const r of rows) {
      const { error } = await supabase.from('note_relations').delete().eq('id', r.id)
      if (error) {
        report('Failed to unlink the note', error)
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
        <span className="list-row-title">Related notes</span>
        {related.length > 0 && <span className="list-row-sub">{related.length}</span>}
      </div>

      {related.length > 0 && (
        <ul className="list">
          {related.map((n) => (
            <li key={n.id} className="list-row">
              <div className="task-row-body">
                <Link
                  to={`/notes/note/${n.id}`}
                  className="list-row-main task-main client-card-link"
                >
                  <span className="list-row-title project-link">{n.title || 'Untitled'} →</span>
                  <span className="list-row-sub">{bookName(n.notebook_id)}</span>
                </Link>
                <button
                  type="button"
                  className="row-action-btn row-action-btn-danger"
                  onClick={() => remove(n.id)}
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
            <option value="">Link a note…</option>
            {options.map((n) => (
              <option key={n.id} value={n.id}>
                {(n.title || 'Untitled') + ' — ' + bookName(n.notebook_id)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Link
          </button>
        </form>
      ) : (
        related.length === 0 && (
          <p className="list-row-sub">No other notes yet to link to.</p>
        )
      )}
    </div>
  )
}

export default RelatedPages
