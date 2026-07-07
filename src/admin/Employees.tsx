import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { addEmployee, fetchEmployees, updateEmployee } from '../lib/api'
import type { Employee } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import { Button, Notice, Skeleton } from '../components/ui'

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [officeOnly, setOfficeOnly] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setEmployees(await fetchEmployees())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submitAdd(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      await addEmployee(email, fullName, officeOnly)
      setEmail('')
      setFullName('')
      setOfficeOnly(false)
      await load()
    } catch (e) {
      setAddError(errorMessage(e))
    } finally {
      setAdding(false)
    }
  }

  async function toggle(emp: Employee, patch: Partial<Employee>) {
    setBusyId(emp.id)
    try {
      await updateEmployee(emp.id, patch)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-3xl font-bold">Employees</h1>
        <p className="text-sm text-fg-3">
          Adding someone here allowlists their email — they can then sign in with a
          magic link.
        </p>
      </header>

      {error && <Notice>{error}</Notice>}

      {/* Add form */}
      <form
        onSubmit={submitAdd}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-edge bg-dusk-800 p-4"
      >
        <label className="flex-1 text-xs" style={{ minWidth: 180 }}>
          <span className="mb-1 block uppercase tracking-wide text-fg-3">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@wildcamel.tv"
            required
            className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
          />
        </label>
        <label className="flex-1 text-xs" style={{ minWidth: 150 }}>
          <span className="mb-1 block uppercase tracking-wide text-fg-3">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="First Last"
            className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-fg-2">
          <input
            type="checkbox"
            checked={officeOnly}
            onChange={(e) => setOfficeOnly(e.target.checked)}
            className="accent-accent-500"
          />
          Office only
        </label>
        <Button type="submit" disabled={adding}>
          {adding ? 'Adding…' : 'Add employee'}
        </Button>
        {addError && (
          <div className="w-full">
            <Notice>{addError}</Notice>
          </div>
        )}
      </form>

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-dusk-700 text-left text-xs uppercase tracking-wide text-fg-3">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Office only</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {employees.map((e) => (
                <tr key={e.id} className="bg-dusk-800">
                  <td className="px-4 py-3 font-medium text-fg">
                    {e.full_name ?? '—'}
                    {e.is_admin && (
                      <span className="ml-2 text-[10px] uppercase text-accent-300">admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-fg-2">{e.email}</td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busyId === e.id}
                      onClick={() => toggle(e, { office_only: !e.office_only })}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        e.office_only
                          ? 'bg-gold-tint text-gold'
                          : 'bg-dusk-700 text-fg-3 hover:text-fg-2'
                      }`}
                    >
                      {e.office_only ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        e.active ? 'text-oasis' : 'text-fg-3'
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${e.active ? 'bg-oasis' : 'bg-edge-strong'}`} />
                      {e.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.is_admin ? (
                      <span className="text-xs text-fg-3">—</span>
                    ) : (
                      <button
                        disabled={busyId === e.id}
                        onClick={() => toggle(e, { active: !e.active })}
                        className={`text-xs font-medium ${
                          e.active
                            ? 'text-danger-fg hover:underline'
                            : 'text-oasis hover:underline'
                        }`}
                      >
                        {e.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
