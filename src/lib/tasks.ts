import type { Task, TaskStatus } from './database.types'
import { dayjs, fromDisplayTz } from './time'

export function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done') return false
  // The deadline is end-of-due-day in the ORG's timezone, not the viewer's.
  return fromDisplayTz(task.due_date).endOf('day').isBefore(dayjs())
}

export const nextStatus: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}
