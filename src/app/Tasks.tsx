import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import {
  createTask,
  deleteTask,
  fetchTasks,
  setTaskStatus,
  updateTask,
} from '../lib/api'
import type { Task, TaskStatus } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import { Button, EmptyState, Notice, Skeleton } from '../components/ui'
import { TaskCard } from '../components/TaskCard'
import { PushToggle } from '../components/PushToggle'
import { isOverdue } from '../lib/tasks'

const GROUPS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
]

export default function Tasks() {
  const { state } = useAuth()
  const meId = state.status === 'employee' || state.status === 'admin' ? state.employee.id : ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const all = await fetchTasks()
      // Employee tasks screen shows only tasks assigned to me (my worklist).
      setTasks(all.filter((t) => t.assigned_to === meId))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [meId])

  useEffect(() => {
    load()
  }, [load])

  async function cycle(task: Task, next: TaskStatus) {
    setBusyId(task.id)
    // optimistic
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await setTaskStatus(task.id, next)
      await load()
    } catch (e) {
      setError(errorMessage(e))
      await load()
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

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] }
    for (const t of tasks) g[t.status].push(t)
    // overdue first within to-do / in-progress
    for (const k of ['todo', 'in_progress'] as const) {
      g[k].sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)))
    }
    return g
  }, [tasks])

  const openCount = grouped.todo.length + grouped.in_progress.length

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-display text-2xl font-bold">My tasks</h1>
          <p className="text-sm text-fg-3">{openCount} open</p>
        </div>
        <Button onClick={() => setAdding(true)}>+ Add</Button>
      </header>

      {error && <Notice>{error}</Notice>}

      {meId && <PushToggle employeeId={meId} />}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          hint="Add a personal to-do, or wait for Rudy to assign you something."
        >
          <Button onClick={() => setAdding(true)}>Add your first task</Button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {GROUPS.map(({ key, label }) => {
            const items = grouped[key]
            if (items.length === 0) return null
            return (
              <section key={key}>
                <h2 className="text-display mb-2 text-sm font-bold tracking-wide text-fg-2">
                  {label} <span className="text-fg-3">· {items.length}</span>
                </h2>
                <div className="space-y-2">
                  {items.map((t) => {
                    const mine = t.created_by === meId
                    return (
                      <TaskCard
                        key={t.id}
                        task={t}
                        assignedByAdmin={!mine}
                        onCycleStatus={(next) => cycle(t, next)}
                        onEdit={mine ? () => setEditing(t) : undefined}
                        onDelete={mine ? () => remove(t) : undefined}
                        canEdit={mine}
                        busy={busyId === t.id}
                      />
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {(adding || editing) && (
        <TaskSheet
          meId={meId}
          task={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={() => {
            setAdding(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// Bottom sheet for adding a personal to-do or editing one you created.
function TaskSheet({
  meId,
  task,
  onClose,
  onSaved,
}: {
  meId: string
  task: Task | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
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
          priority,
          due_date: dueDate || null,
        })
      } else {
        await createTask({
          title,
          description,
          assigned_to: meId,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-t-2xl border border-edge bg-dusk-800 p-5 sm:rounded-2xl"
      >
        <h2 className="text-display text-lg font-bold">
          {task ? 'Edit task' : 'New personal task'}
        </h2>
        <Input label="Title" value={title} onChange={setTitle} autoFocus required />
        <Textarea label="Description (optional)" value={description} onChange={setDescription} />
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
          <Input label="Due date" type="date" value={dueDate} onChange={setDueDate} />
        </div>
        {error && <Notice>{error}</Notice>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : task ? 'Save' : 'Add task'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Input({
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
        className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none [color-scheme:dark]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </label>
  )
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
        {label}
      </span>
      <textarea
        rows={2}
        className="w-full resize-none rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
