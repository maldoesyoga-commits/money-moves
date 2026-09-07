import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO, formatDueDate } from './lib/taskDates'
import { formatMoney } from './lib/format'
import { nextOccurrence } from './lib/recurrence'
import { slots, formatSlot, currentSlot, slotsCovered, BLOCK_KINDS, SLOT_MIN } from './lib/timeBlocks'
import { startFocus } from './lib/focus'

const MAX_PRIORITIES = 3

function PlanningDay({ date, onBackToMonth }) {
  const [priorities, setPriorities] = useState([])
  const [tasks, setTasks] = useState([])
  const [blocks, setBlocks] = useState([])
  const [txns, setTxns] = useState([])
  const [categories, setCategories] = useState([])

  const [priorityDraft, setPriorityDraft] = useState('')
  const [intention, setIntention] = useState(null)
  const [intentionDraft, setIntentionDraft] = useState('')
  const [intentionSaved, setIntentionSaved] = useState(false)
  const [openSlot, setOpenSlot] = useState(null)
  const [blockDraft, setBlockDraft] = useState({ label: '', kind: 'focus', duration: SLOT_MIN })

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const isToday = date === todayISO()

  const loadPriorities = useCallback(async () => {
    const { data, error } = await supabase
      .from('plan_entries')
      .select('*')
      .eq('horizon', 'day')
      .eq('start_date', date)
      .order('sort_order')

    if (error) {
      report('Failed to load the day plan', error)
      return
    }

    const found = data.find((row) => row.entry_kind === 'intention') || null
    setIntention(found)
    setIntentionDraft(found?.title || '')
    setIntentionSaved(false)
    setPriorities(data.filter((row) => row.entry_kind !== 'intention'))
  }, [date])

  // Today's tasks plus anything already overdue — the overdue ones are the
  // whole point of looking at a day view.
  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'done')
      .lte('due_date', date)
      .order('due_date')

    if (error) {
      report('Failed to load tasks', error)
      return
    }

    setTasks(data)
  }, [date])

  const loadBlocks = useCallback(async () => {
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('block_date', date)
      .order('start_min')

    if (error) {
      report('Failed to load time blocks', error)
      return
    }

    setBlocks(data)
  }, [date])

  const loadMoney = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('txn_date', date)
      .order('created_at', { ascending: false })

    if (error) {
      report('Failed to load transactions', error)
      return
    }

    setTxns(data)

    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (categoryError) {
      report('Failed to load categories', categoryError)
      return
    }

    setCategories(categoryRows)
  }, [date])

  useEffect(() => {
    loadPriorities()
    loadTasks()
    loadBlocks()
    loadMoney()
  }, [loadPriorities, loadTasks, loadBlocks, loadMoney])

  // Exactly one intention per day — created on first save, updated after.
  async function saveIntention() {
    const trimmed = intentionDraft.trim()

    if (!trimmed) {
      if (!intention) return
      const { error } = await supabase.from('plan_entries').delete().eq('id', intention.id)
      if (error) {
        report('Failed to clear the intention', error)
        return
      }
      setIntention(null)
      setIntentionSaved(true)
      return
    }

    if (intention) {
      const { error } = await supabase
        .from('plan_entries')
        .update({ title: trimmed })
        .eq('id', intention.id)

      if (error) {
        report('Failed to save the intention', error)
        return
      }

      setIntention({ ...intention, title: trimmed })
      setIntentionSaved(true)
      return
    }

    const { data, error } = await supabase
      .from('plan_entries')
      .insert({
        horizon: 'day',
        start_date: date,
        end_date: date,
        title: trimmed,
        entry_kind: 'intention',
        sort_order: -1,
      })
      .select()
      .single()

    if (error) {
      report('Failed to save the intention', error)
      return
    }

    setIntention(data)
    setIntentionSaved(true)
  }

  async function addPriority(e) {
    e.preventDefault()

    const trimmed = priorityDraft.trim()
    if (!trimmed) return

    if (priorityRows.length >= MAX_PRIORITIES) return

    const { error } = await supabase.from('plan_entries').insert({
      horizon: 'day',
      start_date: date,
      end_date: date,
      title: trimmed,
      entry_kind: 'priority',
      is_priority: true,
      sort_order: priorityRows.length,
    })

    if (error) {
      report('Failed to add priority', error)
      return
    }

    setPriorityDraft('')
    loadPriorities()
  }

  async function updatePriority(id, patch) {
    setPriorities((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('plan_entries').update(patch).eq('id', id)

    if (error) {
      report('Failed to update priority', error)
      loadPriorities()
    }
  }

  async function deletePriority(id) {
    setPriorities((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('plan_entries').delete().eq('id', id)

    if (error) {
      report('Failed to delete priority', error)
      loadPriorities()
    }
  }

  async function toggleTask(task) {
    const done = task.status !== 'done'
    setTasks((prev) => prev.filter((row) => row.id !== task.id))

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', task.id)

    if (error) {
      report('Failed to update task', error)
      loadTasks()
      return
    }

    if (done && task.repeat_every) {
      const { error: repeatError } = await supabase.from('tasks').insert(nextOccurrence(task))
      if (repeatError) report('Failed to create next occurrence', repeatError)
    }
  }

  async function saveBlock(e, startMin) {
    e.preventDefault()

    const trimmed = blockDraft.label.trim()
    if (!trimmed) return

    const { error } = await supabase.from('time_blocks').insert({
      block_date: date,
      start_min: startMin,
      duration_min: Number(blockDraft.duration) || SLOT_MIN,
      label: trimmed,
      kind: blockDraft.kind,
    })

    if (error) {
      report('Failed to save the block', error)
      return
    }

    setOpenSlot(null)
    setBlockDraft({ label: '', kind: 'focus', duration: SLOT_MIN })
    loadBlocks()
  }

  async function deleteBlock(id) {
    setBlocks((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('time_blocks').delete().eq('id', id)

    if (error) {
      report('Failed to delete the block', error)
      loadBlocks()
    }
  }

  async function toggleBlockDone(block) {
    updateBlock(block.id, { done: !block.done })
  }

  async function updateBlock(id, patch) {
    setBlocks((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('time_blocks').update(patch).eq('id', id)

    if (error) {
      report('Failed to update the block', error)
      loadBlocks()
    }
  }

  async function addTransaction(e) {
    e.preventDefault()

    const value = Number(amount)
    if (!value) return

    // No account attached, so balances in Money Moves stay untouched —
    // set those there, where the transfer logic lives.
    const { error } = await supabase.from('transactions').insert({
      txn_date: date,
      amount: value,
      direction: 'out',
      category_id: categoryId || null,
      note: note.trim() || null,
    })

    if (error) {
      report('Failed to add the transaction', error)
      return
    }

    setAmount('')
    setNote('')
    loadMoney()
  }

  const priorityRows = priorities.filter((row) => row.entry_kind === 'priority')
  const noteRows = priorities.filter((row) => row.entry_kind === 'note')
  const overdue = tasks.filter((task) => task.due_date && task.due_date < date)
  const dueToday = tasks.filter((task) => task.due_date === date)
  const spentToday = txns
    .filter((txn) => txn.direction === 'out' && !txn.debt_id)
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

  const blockBySlot = {}
  blocks.forEach((block) => {
    slotsCovered(block).forEach((slot, index) => {
      blockBySlot[slot] = { block, isStart: index === 0 }
    })
  })

  const nowSlot = currentSlot()

  return (
    <>
      {onBackToMonth && (
        <p className="hub-footer month-backlink">
          <button type="button" className="row-action-btn" onClick={onBackToMonth}>
            ‹ Back to the month
          </button>
        </p>
      )}

      <div className="card intention-card">
        <h2>Today&apos;s intention</h2>
        <p className="list-row-sub">
          One line. How you want the day to go, not what you&apos;ll get done.
        </p>

        <input
          type="text"
          className="quick-add-title intention-input"
          value={intentionDraft}
          onChange={(e) => {
            setIntentionDraft(e.target.value)
            setIntentionSaved(false)
          }}
          onBlur={saveIntention}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="Steady and unhurried."
        />

        {intentionSaved && <p className="list-row-sub">Saved.</p>}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Three priorities</h2>
          <span className="list-row-sub">
            {priorityRows.filter((row) => row.done).length} of {priorityRows.length} done
          </span>
        </div>
        <p className="list-row-sub">
          If only these three happen, the day worked. Three is the cap.
        </p>

        <ul className="list">
          {priorityRows.map((row, index) => (
            <li key={row.id} className={`list-row task-row${row.done ? ' task-done' : ''}`}>
              <div className="task-row-body">
                <span className="priority-number">{index + 1}</span>
                <button
                  type="button"
                  className={`task-check${row.done ? ' checked' : ''}`}
                  onClick={() => updatePriority(row.id, { done: !row.done })}
                  aria-label={row.done ? 'Mark as not done' : 'Mark as done'}
                >
                  {row.done ? '✓' : ''}
                </button>
                <div className="list-row-main task-main">
                  <span className="list-row-title task-title">{row.title}</span>
                </div>
                <button
                  type="button"
                  className="row-action-btn"
                  onClick={() => startFocus({ label: row.title })}
                  title="Start a 50 minute block on this"
                >
                  Focus
                </button>
                <button
                  type="button"
                  className="row-action-btn row-action-btn-danger"
                  onClick={() => deletePriority(row.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {priorityRows.length < MAX_PRIORITIES && (
          <form className="mini-form" onSubmit={addPriority}>
            <input
              type="text"
              value={priorityDraft}
              onChange={(e) => setPriorityDraft(e.target.value)}
              placeholder={`Priority ${priorityRows.length + 1}`}
            />
            <button type="submit">Add</button>
          </form>
        )}

        {noteRows.length > 0 && (
          <>
            <h3>Also today</h3>
            <ul className="list">
              {noteRows.map((row) => (
                <li key={row.id} className={`list-row task-row${row.done ? ' task-done' : ''}`}>
                  <div className="task-row-body">
                    <button
                      type="button"
                      className={`task-check${row.done ? ' checked' : ''}`}
                      onClick={() => updatePriority(row.id, { done: !row.done })}
                      aria-label="Toggle"
                    >
                      {row.done ? '✓' : ''}
                    </button>
                    <div className="list-row-main task-main">
                      <span className="list-row-title task-title">{row.title}</span>
                    </div>
                    {priorityRows.length < MAX_PRIORITIES && (
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() =>
                          updatePriority(row.id, { entry_kind: 'priority', is_priority: true })
                        }
                      >
                        Make a priority
                      </button>
                    )}
                    <button
                      type="button"
                      className="row-action-btn row-action-btn-danger"
                      onClick={() => deletePriority(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>The day</h2>
          <Link to="/focus" className="row-action-btn">
            Focus timer
          </Link>
        </div>

        <div className="day-timeline">
          {slots().map((slot) => {
            const entry = blockBySlot[slot]
            const isNow = isToday && slot === nowSlot

            if (entry && !entry.isStart) return null

            return (
              <div
                key={slot}
                className={`slot${isNow ? ' slot-now' : ''}${entry ? ' slot-filled' : ''}`}
                style={
                  entry
                    ? { gridRow: `span ${Math.max(1, entry.block.duration_min / SLOT_MIN)}` }
                    : undefined
                }
              >
                <span className="slot-time">{formatSlot(slot)}</span>

                {entry ? (
                  <div className={`slot-block kind-${entry.block.kind}${entry.block.done ? ' done' : ''}`}>
                    <button
                      type="button"
                      className="slot-label"
                      onClick={() => toggleBlockDone(entry.block)}
                      title="Mark done"
                    >
                      {entry.block.done ? '✓ ' : ''}
                      {entry.block.label}
                    </button>
                    <div className="slot-actions">
                      <button
                        type="button"
                        className="row-action-btn"
                        onClick={() =>
                          startFocus({
                            label: entry.block.label,
                            minutes: Math.min(90, entry.block.duration_min),
                          })
                        }
                      >
                        Focus
                      </button>
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteBlock(entry.block.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ) : openSlot === slot ? (
                  <form className="slot-form" onSubmit={(e) => saveBlock(e, slot)}>
                    <input
                      type="text"
                      value={blockDraft.label}
                      onChange={(e) => setBlockDraft({ ...blockDraft, label: e.target.value })}
                      placeholder="what's happening"
                      autoFocus
                    />
                    <select
                      className="inline-select"
                      value={blockDraft.kind}
                      onChange={(e) => setBlockDraft({ ...blockDraft, kind: e.target.value })}
                    >
                      {BLOCK_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="inline-select"
                      value={blockDraft.duration}
                      onChange={(e) => setBlockDraft({ ...blockDraft, duration: e.target.value })}
                    >
                      <option value={30}>30 min</option>
                      <option value={60}>1 hr</option>
                      <option value={90}>1.5 hr</option>
                      <option value={120}>2 hr</option>
                    </select>
                    <button type="submit" className="row-action-btn">
                      Save
                    </button>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => setOpenSlot(null)}
                    >
                      ×
                    </button>
                  </form>
                ) : (
                  <button type="button" className="slot-empty" onClick={() => setOpenSlot(slot)}>
                    +
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Tasks</h2>
          <Link to="/tasks" className="row-action-btn">
            Open Tasks
          </Link>
        </div>

        {overdue.length > 0 && (
          <>
            <h3 className="overdue-heading">Overdue · {overdue.length}</h3>
            <ul className="list">
              {overdue.map((task) => (
                <li key={task.id} className="list-row task-row">
                  <div className="task-row-body">
                    <button
                      type="button"
                      className="task-check"
                      onClick={() => toggleTask(task)}
                      aria-label="Mark as done"
                    />
                    <div className="list-row-main task-main">
                      <span className="list-row-title">{task.title}</span>
                      <span className="list-row-sub task-overdue">
                        {formatDueDate(task.due_date)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="row-action-btn"
                      onClick={() => startFocus({ label: task.title, taskId: task.id })}
                    >
                      Focus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3>Due {isToday ? 'today' : formatDueDate(date)} · {dueToday.length}</h3>
        {dueToday.length === 0 ? (
          <p className="empty-text">Nothing due.</p>
        ) : (
          <ul className="list">
            {dueToday.map((task) => (
              <li key={task.id} className="list-row task-row">
                <div className="task-row-body">
                  <button
                    type="button"
                    className="task-check"
                    onClick={() => toggleTask(task)}
                    aria-label="Mark as done"
                  />
                  <div className="list-row-main task-main">
                    <span className="list-row-title">{task.title}</span>
                  </div>
                  <button
                    type="button"
                    className="row-action-btn"
                    onClick={() => startFocus({ label: task.title, taskId: task.id })}
                  >
                    Focus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="project-scope-header">
          <h2>Spending</h2>
          <span className="money">{formatMoney(spentToday)}</span>
        </div>

        <form className="field-row" onSubmit={addTransaction}>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="amount"
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="what for"
          />
          <button type="submit">Log</button>
        </form>

        {txns.length === 0 ? (
          <p className="empty-text">Nothing logged.</p>
        ) : (
          <ul className="list">
            {txns.map((txn) => (
              <li key={txn.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{txn.note || 'Transaction'}</span>
                  <span className="list-row-sub">
                    {categories.find((category) => category.id === txn.category_id)?.name ||
                      'uncategorised'}
                  </span>
                </div>
                <span className={txn.direction === 'in' ? 'amount-in' : 'amount-out'}>
                  {txn.direction === 'in' ? '+' : '-'}
                  {formatMoney(txn.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="list-row-sub">
          Quick entries here don&apos;t touch account balances —{' '}
          <Link to="/money/transactions" className="project-link">
            set those in Money Moves
          </Link>
          .
        </p>
      </div>
    </>
  )
}

export default PlanningDay
