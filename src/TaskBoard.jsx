import { formatDueDate, isOverdue } from './lib/taskDates'

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
]

const ORDER = COLUMNS.map((column) => column.key)

// Status board. Moving with ‹ › rather than drag — it works on a phone,
// which dragging does not.
function TaskBoard({ tasks, projectName, onMove, onOpen }) {
  return (
    <div className="board">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => (task.status || 'todo') === column.key)

        return (
          <div className="board-column" key={column.key}>
            <div className="board-column-head">
              <h3>{column.label}</h3>
              <span className="list-row-sub">{columnTasks.length}</span>
            </div>

            {columnTasks.length === 0 ? (
              <p className="empty-text">—</p>
            ) : (
              <ul className="board-cards">
                {columnTasks.map((task) => {
                  const index = ORDER.indexOf(task.status || 'todo')
                  const late = task.status !== 'done' && isOverdue(task.due_date)

                  return (
                    <li key={task.id} className="board-card">
                      <button
                        type="button"
                        className="board-card-title"
                        onClick={() => onOpen(task)}
                      >
                        {task.title}
                      </button>

                      <div className="board-card-meta">
                        {task.due_date && (
                          <span className={late ? 'task-overdue' : 'list-row-sub'}>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                        {task.priority && (
                          <span className={`priority-pill priority-${task.priority}`}>
                            {task.priority}
                          </span>
                        )}
                        {task.project_id && (
                          <span className="list-row-sub">{projectName(task.project_id)}</span>
                        )}
                      </div>

                      <div className="stage-nudge">
                        <button
                          type="button"
                          className="row-action-btn"
                          disabled={index <= 0}
                          onClick={() => onMove(task, ORDER[index - 1])}
                          aria-label="Move left"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="row-action-btn"
                          disabled={index >= ORDER.length - 1}
                          onClick={() => onMove(task, ORDER[index + 1])}
                          aria-label="Move right"
                        >
                          ›
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TaskBoard
