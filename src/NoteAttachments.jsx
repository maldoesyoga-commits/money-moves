import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { report } from './lib/report'

// Attachments on a single note — links (reference docs, URLs) and uploaded
// files. Files go in the existing "receipts" storage bucket under the user's
// own folder; a row in note_attachments records where each one lives.
function extensionFromFile(file) {
  const parts = file.name.split('.')
  if (parts.length > 1) return parts.pop().toLowerCase()
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'application/pdf') return 'pdf'
  return 'bin'
}

function NoteAttachments({ noteId }) {
  const [items, setItems] = useState([])
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('note_attachments')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at')

    if (error) {
      report('Failed to load attachments — run supabase/note-attachments.sql?', error)
      setItems([])
      return
    }

    // Files in a private bucket need a signed URL to be viewable.
    const withUrls = await Promise.all(
      (data || []).map(async (a) => {
        if (a.kind === 'file' && a.storage_path) {
          const { data: signed } = await supabase.storage
            .from('receipts')
            .createSignedUrl(a.storage_path, 3600)
          return { ...a, signedUrl: signed?.signedUrl || null }
        }
        return a
      }),
    )

    setItems(withUrls)
  }, [noteId])

  useEffect(() => {
    load()
  }, [load])

  async function addLink(e) {
    e.preventDefault()

    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    const { error } = await supabase.from('note_attachments').insert({
      note_id: noteId,
      kind: 'link',
      label: label.trim() || trimmedUrl,
      url: trimmedUrl,
    })

    if (error) {
      report('Failed to add the link', error)
      return
    }

    setLabel('')
    setUrl('')
    load()
  }

  async function addFile(file) {
    if (!file) return
    setUploading(true)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      report('Not signed in — could not upload', userError)
      setUploading(false)
      return
    }

    const path = `${userData.user.id}/note-attachments/${crypto.randomUUID()}.${extensionFromFile(file)}`

    const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file)
    if (uploadError) {
      report('Failed to upload the file', uploadError)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('note_attachments').insert({
      note_id: noteId,
      kind: 'file',
      label: file.name,
      storage_path: path,
      mime: file.type || null,
    })

    if (insertError) {
      report('Failed to save the attachment', insertError)
      setUploading(false)
      return
    }

    setUploading(false)
    load()
  }

  async function remove(att) {
    setItems((prev) => prev.filter((a) => a.id !== att.id))

    if (att.kind === 'file' && att.storage_path) {
      await supabase.storage.from('receipts').remove([att.storage_path])
    }

    const { error } = await supabase.from('note_attachments').delete().eq('id', att.id)
    if (error) {
      report('Failed to remove the attachment', error)
      load()
    }
  }

  return (
    <div
      className="note-attachments"
      style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}
    >
      <div className="budget-row-header">
        <span className="list-row-title">Attachments</span>
        {items.length > 0 && <span className="list-row-sub">{items.length}</span>}
      </div>

      {items.length > 0 && (
        <ul className="list">
          {items.map((a) => {
            const isImage = a.kind === 'file' && (a.mime || '').startsWith('image/')
            const href = a.kind === 'link' ? a.url : a.signedUrl

            return (
              <li key={a.id} className="list-row">
                <div className="task-row-body">
                  {isImage && a.signedUrl && (
                    <a
                      href={a.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="receipt-thumb-link"
                    >
                      <img src={a.signedUrl} alt={a.label || 'image'} className="receipt-thumb" />
                    </a>
                  )}
                  <div className="list-row-main task-main">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="list-row-title project-link"
                      >
                        {a.label || a.url || 'Attachment'} ↗
                      </a>
                    ) : (
                      <span className="list-row-title">{a.label || 'Attachment'}</span>
                    )}
                    <span className="list-row-sub">
                      {a.kind === 'link' ? 'link' : a.mime || 'file'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn row-action-btn-danger"
                    onClick={() => remove(a)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form className="field-row" onSubmit={addLink}>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="label (optional)"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="paste a URL or doc link"
        />
        <button type="submit" className="btn-secondary">
          Add link
        </button>
      </form>

      <label className="filter-toggle">
        {uploading ? 'Uploading…' : 'Attach image or file'}
        <input
          type="file"
          onChange={(e) => {
            const file = e.target.files?.[0]
            addFile(file)
            e.target.value = ''
          }}
          disabled={uploading}
        />
      </label>
    </div>
  )
}

export default NoteAttachments
