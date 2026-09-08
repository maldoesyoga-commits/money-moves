import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

function MoodBoard() {
  const { brand } = useBrand()

  const [pins, setPins] = useState([])
  const [editingId, setEditingId] = useState(null)

  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('brand_moodboard')
      .select('*')
      .eq('brand', brand)
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.log('Failed to load mood board (run supabase/moodboard.sql?):', error.message)
      setPins([])
      return
    }

    setPins(data)
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()

    const trimmed = imageUrl.trim()
    if (!trimmed) return

    const { error } = await supabase.from('brand_moodboard').insert({
      brand,
      image_url: trimmed,
      caption: caption.trim() || null,
      sort_order: pins.length,
    })

    if (error) {
      console.log('Failed to add pin', error.message)
      return
    }

    setImageUrl('')
    setCaption('')
    load()
  }

  function updateLocal(id, patch) {
    setPins((prev) => prev.map((pin) => (pin.id === id ? { ...pin, ...patch } : pin)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('brand_moodboard').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save pin', error.message)
      load()
    }
  }

  async function deletePin(id) {
    setPins((prev) => prev.filter((pin) => pin.id !== id))
    const { error } = await supabase.from('brand_moodboard').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete pin', error.message)
      load()
    }
  }

  return (
    <div className="brand-tab-body">
      <div className="card">
        <form className="quick-add" onSubmit={handleAdd}>
          <input
            type="url"
            className="quick-add-title"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (Drive share link, etc.)"
          />
          <div className="field-row">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="caption (optional)"
            />
            <button type="submit">Add</button>
          </div>
        </form>
        <p className="brand-hint">
          Paste an image link — for Google Drive, right-click → Share → “Anyone with the
          link”, then use the file’s share URL.
        </p>
      </div>

      {pins.length === 0 ? (
        <div className="card">
          <EmptyState icon="🖼️" title="Mood board is empty">
            Pin the images that capture the vibe — textures, light, colours, spaces. Paste an
            image URL above to start.
          </EmptyState>
        </div>
      ) : (
        <div className="moodboard-grid">
          {pins.map((pin) => {
            const editing = editingId === pin.id

            return (
              <figure className="mood-pin" key={pin.id}>
                <div className="mood-pin-image">
                  <img src={pin.image_url} alt={pin.caption || 'Mood board image'} />
                </div>
                {editing ? (
                  <div className="mood-pin-edit">
                    <input
                      type="url"
                      value={pin.image_url}
                      onChange={(e) => updateLocal(pin.id, { image_url: e.target.value })}
                      onBlur={(e) => persist(pin.id, { image_url: e.target.value.trim() })}
                    />
                    <input
                      type="text"
                      value={pin.caption || ''}
                      placeholder="caption"
                      onChange={(e) => updateLocal(pin.id, { caption: e.target.value })}
                      onBlur={(e) => persist(pin.id, { caption: e.target.value.trim() || null })}
                    />
                    <button
                      type="button"
                      className="row-action-btn row-action-btn-danger"
                      onClick={() => deletePin(pin.id)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setEditingId(null)}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <figcaption className="mood-pin-caption">
                    <span>{pin.caption}</span>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setEditingId(pin.id)}
                    >
                      Edit
                    </button>
                  </figcaption>
                )}
              </figure>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MoodBoard
