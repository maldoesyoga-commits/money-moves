import { supabase } from './supabase'
import { todayISO } from './taskDates'

function shift(iso, days) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Turn a template's lines into real tasks. Offsets are counted from the anchor
// date, so "shoot day" can put prep on -2 and the edit on +1. An item with no
// offset lands in No date, which is where open-ended steps belong.
export function tasksFromTemplate(items, { anchor = todayISO(), projectId = null } = {}) {
  return items.map((item) => {
    const task = {
      title: item.title,
      notes: item.notes || null,
      priority: item.priority || null,
      status: 'todo',
      project_id: projectId || null,
      sort_order: item.sort_order,
    }

    if (item.due_offset_days !== null && item.due_offset_days !== undefined) {
      task.due_date = shift(anchor, Number(item.due_offset_days))
    }

    if (item.repeat_every) {
      task.repeat_every = item.repeat_every
      task.repeat_interval = item.repeat_interval || 1
    }

    return task
  })
}

export async function applyTemplate(template, { anchor, projectId } = {}) {
  const { data: items, error } = await supabase
    .from('task_template_items')
    .select('*')
    .eq('template_id', template.id)
    .order('sort_order')

  if (error) return { error }
  if (!items.length) return { count: 0 }

  const rows = tasksFromTemplate(items, {
    anchor: anchor || todayISO(),
    projectId: projectId || template.project_id || null,
  })

  const { error: insertError } = await supabase.from('tasks').insert(rows)

  if (insertError) return { error: insertError }

  return { count: rows.length }
}

export function offsetLabel(days) {
  if (days === null || days === undefined) return 'no date'
  const value = Number(days)
  if (value === 0) return 'on the day'
  if (value === 1) return 'next day'
  if (value === -1) return 'day before'
  return value > 0 ? `+${value} days` : `${value} days`
}
