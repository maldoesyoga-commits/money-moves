// Every database failure in Homestead goes through here. It still logs to
// the console, but it also fires an event the ErrorToast picks up, so a
// failed save is something you SEE rather than something that silently
// does nothing.

const EVENT = 'homestead-error'

// Supabase messages are accurate but not always readable. Translate the
// handful that actually come up.
export function describe(error) {
  const message = error?.message || 'Something went wrong.'

  if (/row-level security/i.test(message)) {
    return "Your account isn't allowed to write to that table — its security policy is missing. Run the matching file in supabase/."
  }

  if (/does not exist|schema cache|could not find/i.test(message)) {
    return "That table or column isn't set up yet — run the matching file in supabase/."
  }

  if (/duplicate key|already exists/i.test(message)) {
    return 'That already exists.'
  }

  if (/violates check constraint/i.test(message)) {
    return "That value isn't one this field accepts."
  }

  if (/violates not-null/i.test(message)) {
    return 'Something required was left empty.'
  }

  if (/foreign key/i.test(message)) {
    return "That's linked to something that no longer exists."
  }

  if (/failed to fetch|networkerror/i.test(message)) {
    return "Couldn't reach the database — check your connection."
  }

  return message
}

export function report(context, error) {
  console.log(context, error?.message)

  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { context, message: describe(error) } }),
  )
}

export function onReport(handler) {
  const listener = (event) => handler(event.detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
