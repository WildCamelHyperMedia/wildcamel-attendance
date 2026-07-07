import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  createTask,
  deleteTask,
  fetchEmployees,
  fetchTasks,
  updateTask,
} from '../lib/api'
import type { Employee, Task, TaskStatus } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import { firstName } from '../lib/format'
import { Button, EmptyState, Notice, Skeleton } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { isOverdue } from '../lib/tasks'

export default function AdminTasks() {
  const { state } = useAuth()
  const meId = state.status === 'admin' ? state.employee.id : ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [empFilter, setEmpFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [t, e] = await Promise.all([fetchTasks(), fetchEmployees()])
      setTasks(t)
      setEmployees(e)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const filtered = useMemo(() => {
    let list = tasks
    if (empFilter !== 'all') list = list.filter((t) => t.assigned_to === empFilter)
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter)
    // overdue first, then by created desc
    return [...list].sort((a, b) => {
      const o = Number(isOverdue(b)) - Number(isOverdue(a))
      if (o !== 0) return o
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [tasks, empFilter, statusFilter])

  const overdue = filtered.filter(isOverdue)

  async function cycle(task: Task, next: TaskStatus) {
    setBusyId(task.id)
    try {
      await updateTask(task.id, { status: next })
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(task: Task) {
    if (!confirm(`Delete "${task.title}"?`)) return
    setBusyId(task.id)
    try {
      await deleteTask(task.id)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display text-3xl font-bold">Tasks</h1>
          <p className="text-sm text-fg-3">
            {tasks.filter((t) => t.status !== 'done').length} open across the team
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Assign task</Button>
      </header>

      {error && <Notice>{error}</Notice>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-edge bg-dusk-800 p-4">
        <select
          value={empFilter}
          onChange={(e) => setEmpFilter(e.target.value)}
          className="rounded-lg border border-edge-strong bg-dusk-900 px-3 py-2 text-sm text-fg focus:border-accent-500 focus:outline-none"
        >
          <option value="all">Everyone</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name ?? e.email}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-edge-strong bg-dusk-900 px-3 py-2 text-sm text-fg focus:border-accent-500 focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No tasks match" hint="Assign a task, or clear the filters.">
          <Button onClick={() => setCreating(true)}>Assign a task</Button>
        </EmptyState>
      ) : (
        <>
          {overdue.length > 0 && (
            <section>
              <h2 className="text-display mb-2 text-sm font-bold tracking-wide text-danger-fg">
                Overdue · {overdue.length}
              </h2>
              <div className="space-y-2">
                {overdue.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    assignedByAdmin={t.created_by !== t.assigned_to}
                    assigneeName={firstName(
                      empById.get(t.assigned_to)?.full_name ?? null,
                      empById.get(t.assigned_to)?.email ?? '',
                    )}
                    onCycleStatus={(next) => cycle(t, next)}
                    onEdit={() => setEditing(t)}
                    onDelete={() => remove(t)}
                    canEdit
                    busy={busyId === t.id}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-display mb-2 text-sm font-bold tracking-wide text-fg-2">
              All tasks · {filtered.length}
            </h2>
            <div className="space-y-2">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  assignedByAdmin={t.created_by !== t.assigned_to}
                  assigneeName={firstName(
                    empById.get(t.assigned_to)?.full_name ?? null,
                    empById.get(t.assigned_to)?.email ?? '',
                  )}
                  onCycleStatus={(next) => cycle(t, next)}
                  onEdit={() => setEditing(t)}
                  onDelete={() => remove(t)}
                  canEdit
                  busy={busyId === t.id}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {(creating || editing) && (
        <AssignSheet
          meId={meId}
          employees={employees}
          task={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function AssignSheet({
  meId,
  employees,
  task,
  onClose,
  onSaved,
}: {
  meId: string
  employees: Employee[]
  task: Task | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? meId)
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'normal')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || null,
          assigned_to: assignedTo,
          priority,
          due_date: dueDate || null,
        })
      } else {
        await createTask({
          title,
          description,
          assigned_to: assignedTo,
          created_by: meId,
          priority,
          due_date: dueDate || null,
        })
      }
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-t-2xl border border-edge bg-dusk-800 p-5 sm:rounded-2xl"
      >
        <h2 className="text-display text-lg font-bold">
          {task ? 'Edit task' : 'Assign a task'}
        </h2>
        <TextField label="Title" value={title} onChange={setTitle} autoFocus required />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
            Description
          </span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
            Assign to
          </span>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg focus:border-accent-500 focus:outline-none"
          >
            {employees
              .filter((e) => e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name ?? e.email}
                  {e.id === meId ? ' (me)' : ''}
                </option>
              ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
              Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3 py-2.5 text-sm text-fg focus:border-accent-500 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <TextField label="Due date" type="date" value={dueDate} onChange={setDueDate} />
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : task ? 'Save' : 'Assign'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string
  value: string
  onChange: (v: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none [color-scheme:dark]"
        {...rest}
      />
    </label>
  )
}
