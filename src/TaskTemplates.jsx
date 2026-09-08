import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EmptyState from './EmptyState'
import { todayISO } from './lib/taskDates'
import { REPEATS, REPEAT_LABEL } from './lib/recurrence'
import { applyTemplate, offsetLabel } from './lib/taskTemplates'
import { report } from './lib/report'

function TaskTemplates() {
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [openId, setOpenId] = useState(null)
  const [anchor, setAnchor] = useState(todayISO())
  const [applied, setApplied] = useState(null)

  const [name, setName] = useState('')
  const [drafts, setDrafts] = useState({})

  const load = useCallback(async () => {
    const [{ data: templateRows, error }, { data: projectRows }] = await Promise.all([
      supabase.from('task_templates').select('*').order('sort_order').order('created_at'),
      supabase.from('projects').select('id, name, status').order('sort_order'),
    ])

    if (error) {
      report('Failed to load templates', error)
      return
    }

    setTemplates(templateRows || [])
    setProjects(projectRows || [])

    const ids = (templateRows || []).map((row) => row.id)
    if (ids.length === 0) {
      setItems([])
      return
    }

    const { data: itemRows, error: itemError } = await supabase
      .from('task_template_items')
      .select('*')
      .in('template_id', ids)
      .order('sort_order')

    if (itemError) report('Failed to load template steps', itemError)
    else setItems(itemRows)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createTemplate(e) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase
      .from('task_templates')
      .insert({ name: trimmed, sort_order: templates.length })

    if (error) {
      report('Failed to create template', error)
      return
    }

    setName('')
    load()
  }

  async function updateTemplate(id, patch) {
    setTemplates((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('task_templates').update(patch).eq('id', id)

    if (error) {
      report('Failed to update template', error)
      load()
    }
  }

  async function deleteTemplate(id) {
    setTemplates((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('task_templates').delete().eq('id', id)

    if (error) {
      report('Failed to delete template', error)
      load()
    }
  }

  async function addItem(e, templateId) {
    e.preventDefault()

    const draft = drafts[templateId] || {}
    const trimmed = (draft.title || '').trim()
    if (!trimmed) return

    const payload = {
      template_id: templateId,
      title: trimmed,
      sort_order: items.filter((row) => row.template_id === templateId).length,
    }

    if (draft.offset !== '' && draft.offset !== undefined) {
      payload.due_offset_days = Number(draft.offset)
    }
    if (draft.repeat) {
      payload.repeat_every = draft.repeat
      payload.repeat_interval = Number(draft.interval || 1)
    }
    if (draft.priority) payload.priority = draft.priority

    const { error } = await supabase.from('task_template_items').insert(payload)

    if (error) {
      report('Failed to add step', error)
      return
    }

    setDrafts((prev) => ({ ...prev, [templateId]: {} }))
    load()
  }

  async function updateItem(id, patch) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))

    const { error } = await supabase.from('task_template_items').update(patch).eq('id', id)

    if (error) {
      report('Failed to update step', error)
      load()
    }
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((row) => row.id !== id))

    const { error } = await supabase.from('task_template_items').delete().eq('id', id)

    if (error) {
      report('Failed to delete step', error)
      load()
    }
  }

  async function run(template) {
    const { count, error } = await applyTemplate(template, { anchor })

    if (error) {
      report('Failed to apply template', error)
      return
    }

    setApplied({ name: template.name, count })
  }

  function draftFor(id, key, fallback) {
    return drafts[id]?.[key] ?? fallback
  }

  function setDraft(id, key, value) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  return (
    <>
      <div className="card">
        <h2>Templates</h2>
        <p className="list-row-sub">
          A named set of task lines you stamp out whenever the same thing comes round —
          onboarding a client, a shoot day, month-end. Each line can sit a set number of
          days either side of the date you apply it, so prep lands before and follow-up
          after.
        </p>

        <form className="field-row" onSubmit={createTemplate}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="template name — e.g. New client onboarding"
          />
          <button type="submit">Create template</button>
        </form>

        <div className="task-controls">
          <label className="filter-toggle">
            Apply against
            <input
              type="date"
              className="inline-select"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value || todayISO())}
            />
          </label>
        </div>

        {applied && (
          <p className="budget-gentle-note">
            Added {applied.count} {applied.count === 1 ? 'task' : 'tasks'} from{' '}
            {applied.name}. They&apos;re in your task list now.
          </p>
        )}

        {templates.length === 0 && (
          <EmptyState icon="🧾" title="No templates yet">
            Name one above, then add its steps. Nothing is created until you hit Apply.
          </EmptyState>
        )}
      </div>

      {templates.map((template) => {
        const steps = items.filter((row) => row.template_id === template.id)
        const open = openId === template.id

        return (
          <div className="card" key={template.id}>
            <div className="project-scope-header">
              <h2>{template.name}</h2>
              <div className="stage-nudge">
                <button type="button" className="row-action-btn" onClick={() => run(template)}>
                  Apply
                </button>
                <button
                  type="button"
                  className="row-action-btn"
                  onClick={() => setOpenId(open ? null : template.id)}
                >
                  {open ? 'Close' : 'Edit'}
                </button>
              </div>
            </div>

            <p className="list-row-sub">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              {template.project_id
                ? ` · into ${projects.find((p) => p.id === template.project_id)?.name || 'a project'}`
                : ' · no project'}
              {template.description ? ` — ${template.description}` : ''}
            </p>

            {open && (
              <div className="task-controls">
                <input
                  type="text"
                  className="inline-select"
                  value={template.name}
                  onChange={(e) => updateTemplate(template.id, { name: e.target.value })}
                />
                <input
                  type="text"
                  className="inline-select"
                  value={template.description || ''}
                  placeholder="what it's for"
                  onChange={(e) =>
                    updateTemplate(template.id, { description: e.target.value || null })
                  }
                />
                <select
                  className="inline-select"
                  value={template.project_id || ''}
                  onChange={(e) =>
                    updateTemplate(template.id, { project_id: e.target.value || null })
                  }
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="row-action-btn row-action-btn-danger"
                  onClick={() => deleteTemplate(template.id)}
                >
                  Delete template
                </button>
              </div>
            )}

            {steps.length === 0 ? (
              <p className="empty-text">No steps yet.</p>
            ) : (
              <ul className="list">
                {steps.map((step) => (
                  <li key={step.id} className="list-row">
                    <div className="task-row-body">
                      <div className="list-row-main task-main">
                        <span className="list-row-title task-title">{step.title}</span>
                        <span className="list-row-sub task-meta">
                          <span>{offsetLabel(step.due_offset_days)}</span>
                          {step.priority && (
                            <span className={`priority-pill priority-${step.priority}`}>
                              {step.priority}
                            </span>
                          )}
                          {step.repeat_every && (
                            <span className="repeat-pill">
                              ↻ {REPEAT_LABEL[step.repeat_every]}
                            </span>
                          )}
                        </span>
                      </div>
                      <input
                        type="number"
                        className="target-input"
                        value={step.due_offset_days ?? ''}
                        placeholder="±d"
                        onChange={(e) =>
                          updateItem(step.id, {
                            due_offset_days: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => deleteItem(step.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form className="field-row" onSubmit={(e) => addItem(e, template.id)}>
              <input
                type="text"
                value={draftFor(template.id, 'title', '')}
                onChange={(e) => setDraft(template.id, 'title', e.target.value)}
                placeholder="step"
              />
              <input
                type="number"
                className="target-input"
                value={draftFor(template.id, 'offset', '')}
                onChange={(e) => setDraft(template.id, 'offset', e.target.value)}
                placeholder="±days"
                title="Days from the date you apply the template. Blank means no date."
              />
              <select
                className="inline-select"
                value={draftFor(template.id, 'priority', '')}
                onChange={(e) => setDraft(template.id, 'priority', e.target.value)}
              >
                <option value="">No priority</option>
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                className="inline-select"
                value={draftFor(template.id, 'repeat', '')}
                onChange={(e) => setDraft(template.id, 'repeat', e.target.value)}
              >
                {REPEATS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary">
                Add step
              </button>
            </form>
          </div>
        )
      })}
    </>
  )
}

export default TaskTemplates
