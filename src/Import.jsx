import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { parseStatementText, parsePipeRows } from './lib/statementParser'
import { extractPdfText } from './lib/pdfText'

function buildRows(candidates) {
  return candidates.map((candidate) => ({
    id: crypto.randomUUID(),
    txn_date: candidate.txn_date,
    description: candidate.description,
    amount: candidate.amount.toFixed(2),
    category_id: '',
    direction: candidate.direction || 'out',
    included: true,
  }))
}

function Import() {
  const [categories, setCategories] = useState([])
  const [rows, setRows] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [pipeText, setPipeText] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(null)

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or('archived.is.null,archived.eq.false')

    if (error) {
      console.error('Failed to load categories', error)
      return
    }

    setCategories(data)
  }

  useEffect(() => {
    loadCategories()
  }, [])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null)
    setSavedCount(null)
    setLoadingPdf(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const text = await extractPdfText(arrayBuffer)
      const candidates = parseStatementText(text)
      setRows(buildRows(candidates))
      setAttempted(true)
    } catch (err) {
      console.error('Failed to read PDF', err)
      setFileError("Couldn't read that PDF. Try pasting the statement text below instead.")
      setRows([])
      setAttempted(true)
    } finally {
      setLoadingPdf(false)
      e.target.value = ''
    }
  }

  function handlePasteSubmit(e) {
    e.preventDefault()

    const candidates = parseStatementText(pasteText)
    setRows(buildRows(candidates))
    setAttempted(true)
    setSavedCount(null)
  }

  function handlePipeSubmit(e) {
    e.preventDefault()

    const candidates = parsePipeRows(pipeText)
    setRows(buildRows(candidates))
    setAttempted(true)
    setSavedCount(null)
  }

  function updateRow(id, field, value) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  async function handleSaveSelected() {
    const rowsToInsert = rows
      .filter((row) => row.included)
      .filter((row) => row.amount !== '' && Number(row.amount) > 0)

    if (rowsToInsert.length === 0) return

    setSaving(true)
    setSavedCount(null)

    const payload = rowsToInsert.map((row) => ({
      txn_date: row.txn_date,
      amount: Number(row.amount),
      category_id: row.category_id || null,
      direction: row.direction,
      note: row.description,
    }))

    const { error } = await supabase.from('transactions').insert(payload)

    setSaving(false)

    if (error) {
      console.log(error.message)
      return
    }

    const insertedIds = new Set(rowsToInsert.map((row) => row.id))
    setRows((prev) => prev.filter((row) => !insertedIds.has(row.id)))
    setSavedCount(rowsToInsert.length)
  }

  const selectedRows = rows.filter((row) => row.included)
  const selectedCount = selectedRows.length
  const selectedTotal = selectedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  return (
    <section className="import-page">
      <h1>Import</h1>

      <div className="card">
        <h2>Upload a statement</h2>
        <p className="list-row-sub">
          Upload a PDF bank or credit card statement and we'll pull out the transactions.
        </p>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        {loadingPdf && <p className="list-row-sub">Reading PDF…</p>}
        {fileError && <p className="error-text">{fileError}</p>}
      </div>

      <div className="card">
        <h2>Or paste statement text</h2>
        <p className="list-row-sub">
          Paste raw text from a statement and we'll look for transactions in it the same way.
        </p>
        <form onSubmit={handlePasteSubmit}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={'01/15/2026  Grocery Store  -45.99'}
          />
          <button type="submit">Parse text</button>
        </form>
      </div>

      <div className="card">
        <h2>Paste rows</h2>
        <p className="list-row-sub">
          One transaction per line: date | amount | in/out | description. Blank lines and lines
          starting with # are ignored.
        </p>
        <form onSubmit={handlePipeSubmit}>
          <textarea
            className="pipe-textarea"
            value={pipeText}
            onChange={(e) => setPipeText(e.target.value)}
            rows={6}
            placeholder={'2026-09-05 | 45.99 | out | Grocery Store'}
          />
          <button type="submit">Parse rows</button>
        </form>
      </div>

      {attempted && rows.length === 0 && (
        <div className="card">
          <p className="empty-text">
            We couldn't find any transactions there. Try a different PDF, or paste the statement
            text above.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card">
          <h2>Review transactions</h2>
          <p className="list-row-sub">
            Check the rows you want to import, fix anything that looks off, then save.
          </p>

          <div className="table-scroll">
            <table className="review-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Direction</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.included ? '' : 'row-excluded'}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => updateRow(row.id, 'included', e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.txn_date}
                        onChange={(e) => updateRow(row.id, 'txn_date', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, 'amount', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={row.category_id}
                        onChange={(e) => updateRow(row.id, 'category_id', e.target.value)}
                      >
                        <option value="">—</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="direction-toggle">
                        <button
                          type="button"
                          className={`direction-btn direction-out${row.direction === 'out' ? ' active' : ''}`}
                          onClick={() => updateRow(row.id, 'direction', 'out')}
                        >
                          Out
                        </button>
                        <button
                          type="button"
                          className={`direction-btn direction-in${row.direction === 'in' ? ' active' : ''}`}
                          onClick={() => updateRow(row.id, 'direction', 'in')}
                        >
                          In
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-save-bar">
            <p className="list-row-sub">
              {selectedCount} selected · {formatMoney(selectedTotal)} total
            </p>
            <button type="button" onClick={handleSaveSelected} disabled={saving || selectedCount === 0}>
              {saving ? 'Saving…' : 'Save selected'}
            </button>
          </div>

          {savedCount !== null && (
            <p className="list-row-sub">
              Saved {savedCount} transaction{savedCount === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default Import
