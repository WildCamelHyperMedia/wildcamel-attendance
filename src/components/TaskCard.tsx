import type { Task, TaskStatus } from '../lib/database.types'
import { inTz } from '../lib/time'
import { isOverdue } from '../lib/tasks'

const priorityDot: Record<Task['priority'], string> = {
  low: 'bg-fg-3',
  normal: 'bg-accent-400',
  high: 'bg-gold',
}

const statusCycle: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}

/** A task row. `assignedByAdmin` marks tasks the current user didn't create. */
export function TaskCard({
  task,
  assignedByAdmin,
  assigneeName,
  onCycleStatus,
  onEdit,
  onDelete,
  canEdit,
  busy,
}: {
  task: Task
  assignedByAdmin?: boolean
  assigneeName?: string
  onCycleStatus?: (next: TaskStatus) => void
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
  busy?: boolean
}) {
  const overdue = isOverdue(task)
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-dusk-800 ${
        overdue ? 'border-[#5a2230]' : 'border-edge'
      }`}
    >
      {overdue && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-danger" />
      )}
      <div className={`flex items-start gap-3 p-3.5 ${overdue ? 'bg-overdue-row/40 pl-4' : ''}`}>
        {onCycleStatus && (
          <button
            onClick={() => onCycleStatus(statusCycle[task.status])}
            disabled={busy}
            aria-label={`Mark ${statusCycle[task.status].replace('_', ' ')}`}
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
              task.status === 'done'
                ? 'border-oasis bg-oasis text-dusk-900'
                : task.status === 'in_progress'
                  ? 'border-accent-400 text-accent-400'
                  : 'border-edge-strong text-transparent hover:border-accent-400'
            }`}
          >
            {task.status === 'done' ? (
              <CheckIcon />
            ) : task.status === 'in_progress' ? (
              <span className="size-2 rounded-full bg-accent-400" />
            ) : null}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm font-medium ${
                task.status === 'done' ? 'text-fg-3 line-through' : 'text-fg'
              }`}
            >
              <span className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${priorityDot[task.priority]}`} />
              {task.title}
            </p>
          </div>
          {task.description && (
            <p className="mt-1 text-xs text-fg-3 line-clamp-2">{task.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {assignedByAdmin ? (
              <span className="font-medium text-accent-300">Assigned by Rudy</span>
            ) : (
              <span className="text-fg-3">Personal</span>
            )}
            {assigneeName && <span className="text-fg-3">→ {assigneeName}</span>}
            {task.due_date && (
              <span className={overdue ? 'font-semibold text-danger-fg' : 'text-fg-3'}>
                {overdue ? 'Overdue · ' : 'Due '}
                {inTz(task.due_date).format('D MMM')}
              </span>
            )}
            {task.priority === 'high' && (
              <span className="font-medium text-gold">High</span>
            )}
          </div>
        </div>

        {canEdit && (onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1">
            {onEdit && (
              <button
                onClick={onEdit}
                disabled={busy}
                className="rounded-md p-1.5 text-fg-3 hover:bg-dusk-700 hover:text-fg-2"
                aria-label="Edit task"
              >
                <EditIcon />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={busy}
                className="rounded-md p-1.5 text-fg-3 hover:bg-danger-tint hover:text-danger-fg"
                aria-label="Delete task"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" strokeLinejoin="round" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M6.5 4V3h3v1M5 4l.5 9h5L11 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
