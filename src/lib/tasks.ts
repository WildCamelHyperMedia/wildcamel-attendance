import type { Task, TaskStatus } from './database.types'
import { dayjs } from './time'

export function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done') return false
  return dayjs(task.due_date).endOf('day').isBefore(dayjs())
}

export const nextStatus: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
}
