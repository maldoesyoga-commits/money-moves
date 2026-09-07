import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif']

function isImagePath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

function capitalize(text) {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function extensionFromFile(file) {
  const nameParts = file.name.split('.')
  if (nameParts.length > 1) return nameParts.pop().toLowerCase()
  if (file.type === 'image/png') return 'png'
  if (file.type === 'application/pdf') return 'pdf'
  return 'jpg'
}

function Receipts() {
  const [documents, setDocuments] = useState([])
  const [transactions, setTransactions] = useState([])
  const [signedUrls, setSignedUrls] = useState({})
  const [filterKind, setFilterKind] = useState('')

  const [uploadKind, setUploadKind] = useState('invoice')
  const [uploadDate, setUploadDate] = useState('')
  const [uploadAmount, setUploadAmount] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  async function loadDocuments() {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('doc_date', { ascending: false })

    if (error) {
      console.error('Failed to load documents', error)
      return
    }

    setDocuments(data)
  }

  async function loadTransactionsLite() {
    const { data, error } = await supabase.from('transactions').select('id, txn_date, amount, note')

    if (error) {
      console.error('Failed to load transactions', error)
      return
    }

    setTransactions(data)
  }

  async function loadSignedUrls(docs) {
    const entries = await Promise.all(
      docs.map(async (doc) => {
        const { data, error } = await supabase.storage
          .from('receipts')
          .createSignedUrl(doc.storage_path, 3600)

        if (error) {
          console.error('Failed to create signed URL', error)
          return [doc.id, null]
        }

        return [doc.id, data.signedUrl]
      }),
    )

    setSignedUrls(Object.fromEntries(entries))
  }

  useEffect(() => {
    loadDocuments()
    loadTransactionsLite()
  }, [])

  useEffect(() => {
    if (documents.length === 0) return
    loadSignedUrls(documents)
  }, [documents])

  async function handleStandaloneUpload(e) {
    e.preventDefault()

    if (!uploadFile) return

    setUploading(true)
    setUploadError(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData?.user) {
      const message = userError ? userError.message : 'No authenticated user'
      console.log(message)
      setUploadError(message)
      setUploading(false)
      return
    }

    const ext = extensionFromFile(uploadFile)
    const path = `${userData.user.id}/${crypto.randomUUID()}.${ext}`

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('receipts')
      .upload(path, uploadFile)

    if (uploadErr) {
      console.log(uploadErr.message)
      setUploadError(uploadErr.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('documents').insert({
      kind: uploadKind,
      storage_path: uploadData.path,
      transaction_id: null,
      doc_date: uploadDate,
      amount: uploadAmount ? Number(uploadAmount) : null,
    })

    if (insertError) {
      console.log(insertError.message)
      setUploadError(insertError.message)
      setUploading(false)
      return
    }

    setUploadKind('invoice')
    setUploadDate('')
    setUploadAmount('')
    setUploadFile(null)
    setUploading(false)
    loadDocuments()
  }

  async function handleDelete(doc) {
    const { error: storageError } = await supabase.storage.from('receipts').remove([doc.storage_path])

    if (storageError) {
      console.log(storageError.message)
      return
    }

    const { error: deleteError } = await supabase.from('documents').delete().eq('id', doc.id)

    if (deleteError) {
      console.log(deleteError.message)
      return
    }

    loadDocuments()
  }

  function linkedTxnLabel(transactionId) {
    const txn = transactions.find((t) => t.id === transactionId)
    if (!txn) return 'View linked transaction'
    return `${txn.note || 'Transaction'} · ${formatMoney(txn.amount)}`
  }

  const filteredDocuments = filterKind ? documents.filter((doc) => doc.kind === filterKind) : documents

  return (
    <section className="receipts-page">
      <h1>Receipts</h1>

      <div className="card">
        <h2>Upload a document</h2>
        <p className="list-row-sub">
          Add an invoice, bank statement, or other document that isn't tied to a specific
          transaction.
        </p>
        <form onSubmit={handleStandaloneUpload}>
          <div className="field-row">
            <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value)}>
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
              <option value="statement">Statement</option>
              <option value="other">Other</option>
            </select>
            <input
              type="date"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
              required
            />
            <input
              type="number"
              step="0.01"
              value={uploadAmount}
              onChange={(e) => setUploadAmount(e.target.value)}
              placeholder="amount (optional)"
            />
          </div>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            required
          />
          {uploadError && <p className="error-text">{uploadError}</p>}
          <button type="submit" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload document'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>All documents</h2>
        <div className="transaction-filter-bar">
          <select
            className="inline-select"
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
          >
            <option value="">All kinds</option>
            <option value="receipt">Receipt</option>
            <option value="invoice">Invoice</option>
            <option value="statement">Statement</option>
            <option value="other">Other</option>
          </select>
          <span className="list-row-sub">
            {filteredDocuments.length} document{filteredDocuments.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredDocuments.length === 0 ? (
          <p className="empty-text">No documents yet.</p>
        ) : (
          <ul className="list">
            {filteredDocuments.map((doc) => (
              <li key={doc.id} className="list-row document-row">
                <div className="document-preview">
                  {signedUrls[doc.id] ? (
                    isImagePath(doc.storage_path) ? (
                      <a href={signedUrls[doc.id]} target="_blank" rel="noreferrer">
                        <img src={signedUrls[doc.id]} alt={doc.kind} className="receipt-thumb" />
                      </a>
                    ) : (
                      <a
                        href={signedUrls[doc.id]}
                        target="_blank"
                        rel="noreferrer"
                        className="document-file-link"
                      >
                        View file
                      </a>
                    )
                  ) : (
                    <span className="list-row-sub">No preview</span>
                  )}
                </div>
                <div className="list-row-main document-info">
                  <span className="list-row-title">{capitalize(doc.kind)}</span>
                  <span className="list-row-sub">
                    {doc.doc_date || 'No date'}
                    {doc.amount ? ` · ${formatMoney(doc.amount)}` : ''}
                  </span>
                  {doc.transaction_id && (
                    <Link to="/money/transactions" className="document-txn-link">
                      → {linkedTxnLabel(doc.transaction_id)}
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  className="icon-button document-delete"
                  onClick={() => handleDelete(doc)}
                  aria-label="Delete document"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Receipts
