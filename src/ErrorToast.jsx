import { useEffect, useState } from 'react'
import { onReport } from './lib/report'

// One toast for the whole app. Sits above the bottom nav, stays put until
// dismissed or replaced — a failed save should not scroll away unnoticed.
function ErrorToast() {
  const [problem, setProblem] = useState(null)

  useEffect(() => onReport(setProblem), [])

  if (!problem) return null

  return (
    <div className="error-toast" role="alert">
      <div className="error-toast-body">
        <strong>That didn&apos;t save</strong>
        <p>{problem.message}</p>
        <p className="error-toast-context">{problem.context}</p>
      </div>
      <button
        type="button"
        className="row-action-btn"
        onClick={() => setProblem(null)}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )
}

export default ErrorToast
