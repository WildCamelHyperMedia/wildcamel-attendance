import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAllSessions,
  fetchEmployees,
  fetchTasks,
} from '../lib/api'
import type { AttendanceSession, Employee, Task } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import { firstName } from '../lib/format'
import { useNow } from '../lib/useNow'
import { dayKey, elapsedMs, fmtHours, fmtStopwatch, fmtTime, inTz } from '../lib/time'
import { ContextBadge, EmptyState, Notice, Skeleton, SpectrumStrand } from '../components/ui'

const OPEN_WARN_HOURS = 16

export default function LiveBoard() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(1000)

  const load = useCallback(async () => {
    setError(null)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const [emps, sess, tsk] = await Promise.all([
        fetchEmployees(),
        fetchAllSessions(),
        fetchTasks(),
      ])
      setEmployees(emps)
      setSessions(sess)
      setTasks(tsk)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60000) // refresh every minute
    return () => clearInterval(id)
  }, [load])

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  )

  const openSessions = useMemo(
    () =>
      sessions
        .filter((s) => !s.check_out_at)
        .sort((a, b) => (a.check_in_at < b.check_in_at ? -1 : 1)),
    [sessions],
  )

  const openTaskCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tasks) {
      if (t.status !== 'done') m.set(t.assigned_to, (m.get(t.assigned_to) ?? 0) + 1)
    }
    return m
  }, [tasks])

  const todayKey = dayKey(new Date(now))
  const activeToday = useMemo(() => {
    const ids = new Set(
      sessions.filter((s) => dayKey(s.check_in_at) === todayKey).map((s) => s.employee_id),
    )
    return ids.size
  }, [sessions, todayKey])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-3xl font-bold">Live board</h1>
        <p className="text-sm text-fg-3">
          {inTz(new Date(now)).format('dddd D MMMM, HH:mm')}
        </p>
      </header>

      {error && <Notice>{error}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="On the clock" value={openSessions.length} accent />
        <KPI label="Active today" value={activeToday} />
        <KPI label="Team size" value={employees.filter((e) => e.active).length} />
        <KPI
          label="Open tasks"
          value={tasks.filter((t) => t.status !== 'done').length}
        />
      </div>

      <section>
        <h2 className="text-display mb-3 text-sm font-bold tracking-wide text-fg-2">
          Currently checked in
        </h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : openSessions.length === 0 ? (
          <EmptyState title="No one's on the clock" hint="Open sessions will appear here in real time." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {openSessions.map((s) => {
              const emp = empById.get(s.employee_id)
              const ms = elapsedMs(s.check_in_at, new Date(now))
              const stale = ms > OPEN_WARN_HOURS * 3600000
              return (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-xl border border-edge bg-dusk-800"
                >
                  <SpectrumStrand />
                  <div className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-fg">
                        {emp ? firstName(emp.full_name, emp.email) : 'Unknown'}
                        <ContextBadge ctx={s.in_context} />
                      </p>
                      <p className="mt-0.5 text-xs text-fg-3">
                        Since {fmtTime(s.check_in_at)}
                        {(openTaskCount.get(s.employee_id) ?? 0) > 0 && (
                          <span className="ml-2 text-accent-300">
                            · {openTaskCount.get(s.employee_id)} open tasks
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-mono text-lg font-medium tabular-nums ${
                          stale ? 'text-danger-fg' : 'text-fg'
                        }`}
                      >
                        {fmtStopwatch(ms)}
                      </p>
                      {stale && (
                        <p className="text-[11px] text-danger-fg">over {OPEN_WARN_HOURS}h</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Roster with open-task counts */}
      <section>
        <h2 className="text-display mb-3 text-sm font-bold tracking-wide text-fg-2">
          Team
        </h2>
        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-edge">
                {employees
                  .filter((e) => e.active)
                  .map((e) => {
                    const isIn = openSessions.some((s) => s.employee_id === e.id)
                    const todayMs = sessions
                      .filter(
                        (s) =>
                          s.employee_id === e.id &&
                          dayKey(s.check_in_at) === todayKey &&
                          s.check_out_at,
                      )
                      .reduce((sum, s) => sum + elapsedMs(s.check_in_at, s.check_out_at), 0)
                    return (
                      <tr key={e.id} className="bg-dusk-800">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2 font-medium text-fg">
                            <span
                              className={`size-2 rounded-full ${isIn ? 'bg-oasis' : 'bg-edge-strong'}`}
                            />
                            {firstName(e.full_name, e.email)}
                            {e.is_admin && (
                              <span className="text-[10px] uppercase text-accent-300">admin</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-fg-3">
                          {isIn ? (
                            <span className="text-oasis">On the clock</span>
                          ) : todayMs > 0 ? (
                            `${fmtHours(todayMs)} today`
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-fg-3">
                          {openTaskCount.get(e.id) ?? 0} open
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function KPI({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? 'border-accent-500/40 bg-accent-900/40' : 'border-edge bg-dusk-800'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-fg-3">{label}</p>
      <p className="text-display mt-1 text-3xl font-bold text-fg">{value}</p>
    </div>
  )
}
