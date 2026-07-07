import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  adminCloseSession,
  fetchAllSessions,
  fetchEmployees,
} from '../lib/api'
import type { AttendanceSession, Employee } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import { firstName, contextLabel, toCsv, downloadCsv } from '../lib/format'
import { useNow } from '../lib/useNow'
import {
  dayjs,
  dayKey,
  decimalHours,
  elapsedMs,
  fmtDateTime,
  fmtDayKey,
  fmtHours,
  fmtTime,
  fromDisplayTz,
  getDisplayTz,
  inTz,
} from '../lib/time'
import { Button, ContextBadge, EmptyState, Notice, Skeleton } from '../components/ui'

const OPEN_WARN_HOURS = 16

interface Flags {
  missingCheckout: boolean
  locationUnavailable: boolean
  adminAdjusted: boolean
}

function flagsFor(s: AttendanceSession, nowMs: number): Flags {
  return {
    missingCheckout: !s.check_out_at && elapsedMs(s.check_in_at, new Date(nowMs)) > OPEN_WARN_HOURS * 3600000,
    locationUnavailable: s.in_context === 'unknown' || (!!s.check_out_at && s.out_context === 'unknown'),
    adminAdjusted: !!s.admin_note,
  }
}

export default function Records() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empFilter, setEmpFilter] = useState<string>('all')
  const [from, setFrom] = useState(() => dayjs().subtract(14, 'day').format('YYYY-MM-DD'))
  const [to, setTo] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [fixing, setFixing] = useState<AttendanceSession | null>(null)
  const now = useNow(30000)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // `from`/`to` are display-tz calendar days from the pickers, not browser-tz.
      const fromIso = fromDisplayTz(from).startOf('day').toISOString()
      const toIso = fromDisplayTz(to).endOf('day').toISOString()
      const [emps, sess] = await Promise.all([
        fetchEmployees(),
        fetchAllSessions(fromIso, toIso),
      ])
      setEmployees(emps)
      setSessions(sess)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const filtered = useMemo(
    () => (empFilter === 'all' ? sessions : sessions.filter((s) => s.employee_id === empFilter)),
    [sessions, empFilter],
  )

  // Group rows: employee → day → sessions, with per-day totals.
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, AttendanceSession[]>>()
    for (const s of filtered) {
      const day = dayKey(s.check_in_at)
      if (!map.has(s.employee_id)) map.set(s.employee_id, new Map())
      const days = map.get(s.employee_id)!
      if (!days.has(day)) days.set(day, [])
      days.get(day)!.push(s)
    }
    return map
  }, [filtered])

  function exportCsv() {
    const header = [
      'Employee',
      'Email',
      'Date',
      'Check in',
      'Check out',
      'Hours',
      'In context',
      'Out context',
      'Flags',
      'Admin note',
    ]
    const rows: (string | number | null)[][] = [header]
    const sorted = [...filtered].sort((a, b) =>
      a.check_in_at < b.check_in_at ? 1 : -1,
    )
    for (const s of sorted) {
      const emp = empById.get(s.employee_id)
      const f = flagsFor(s, now)
      const flagList = [
        f.missingCheckout && 'missing-checkout',
        f.locationUnavailable && 'location-unavailable',
        f.adminAdjusted && 'admin-adjusted',
      ]
        .filter(Boolean)
        .join(' ')
      rows.push([
        emp ? emp.full_name ?? emp.email : s.employee_id,
        emp?.email ?? '',
        inTz(s.check_in_at).format('YYYY-MM-DD'),
        fmtTime(s.check_in_at),
        s.check_out_at ? fmtTime(s.check_out_at) : '',
        s.check_out_at ? decimalHours(elapsedMs(s.check_in_at, s.check_out_at)) : '',
        contextLabel(s.in_context),
        s.check_out_at ? contextLabel(s.out_context) : '',
        flagList,
        s.admin_note ?? '',
      ])
    }
    downloadCsv(
      `wildcamel-attendance_${from}_to_${to}.csv`,
      toCsv(rows),
    )
  }

  const empIds = [...grouped.keys()].sort((a, b) => {
    const na = empById.get(a)?.full_name ?? ''
    const nb = empById.get(b)?.full_name ?? ''
    return na.localeCompare(nb)
  })

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-display text-3xl font-bold">Records</h1>
        <Button variant="ghost" onClick={exportCsv} disabled={filtered.length === 0}>
          Export CSV
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-edge bg-dusk-800 p-4">
        <label className="text-xs">
          <span className="mb-1 block uppercase tracking-wide text-fg-3">Employee</span>
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
        </label>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
        <span className="ml-auto text-xs text-fg-3">tz: {getDisplayTz()}</span>
      </div>

      {error && <Notice>{error}</Notice>}

      {loading ? (
        <Skeleton className="h-64" />
      ) : empIds.length === 0 ? (
        <EmptyState title="No records in range" hint="Widen the date range or clear the employee filter." />
      ) : (
        <div className="space-y-6">
          {empIds.map((empId) => {
            const emp = empById.get(empId)
            const days = [...grouped.get(empId)!.entries()].sort((a, b) =>
              a[0] < b[0] ? 1 : -1,
            )
            const totalMs = days
              .flatMap(([, ss]) => ss)
              .filter((s) => s.check_out_at)
              .reduce((sum, s) => sum + elapsedMs(s.check_in_at, s.check_out_at), 0)
            return (
              <section key={empId}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-semibold text-fg">
                    {emp ? firstName(emp.full_name, emp.email) : 'Unknown'}
                    {emp?.office_only && (
                      <span className="ml-2 text-[11px] uppercase text-gold">office only</span>
                    )}
                  </h2>
                  <span className="text-sm text-fg-2">{fmtHours(totalMs)} in range</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-edge">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-dusk-700 text-left text-xs uppercase tracking-wide text-fg-3">
                        <th className="px-4 py-2 font-medium">Date</th>
                        <th className="px-4 py-2 font-medium">In</th>
                        <th className="px-4 py-2 font-medium">Out</th>
                        <th className="px-4 py-2 font-medium">Hours</th>
                        <th className="px-4 py-2 font-medium">Context</th>
                        <th className="px-4 py-2 font-medium">Flags</th>
                        <th className="px-4 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      {days.map(([day, ss]) => {
                        const dayMs = ss
                          .filter((s) => s.check_out_at)
                          .reduce((sum, s) => sum + elapsedMs(s.check_in_at, s.check_out_at), 0)
                        return ss.map((s, i) => {
                          const f = flagsFor(s, now)
                          const flagged = f.missingCheckout || f.locationUnavailable || f.adminAdjusted
                          return (
                            <tr
                              key={s.id}
                              className={flagged ? 'bg-overdue-row/30' : 'bg-dusk-800'}
                            >
                              <td className="px-4 py-2.5 text-fg-2">
                                {i === 0 ? (
                                  <div>
                                    <div>{fmtDayKey(day)}</div>
                                    <div className="text-[11px] text-fg-3">{fmtHours(dayMs)}</div>
                                  </div>
                                ) : (
                                  ''
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-fg-2 tabular-nums">
                                {fmtTime(s.check_in_at)}
                              </td>
                              <td className="px-4 py-2.5 font-mono tabular-nums">
                                {s.check_out_at ? (
                                  <span className="text-fg-2">{fmtTime(s.check_out_at)}</span>
                                ) : (
                                  <span className="text-oasis">open</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-fg">
                                {s.check_out_at
                                  ? fmtHours(elapsedMs(s.check_in_at, s.check_out_at))
                                  : '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                <ContextBadge ctx={s.in_context} />
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {f.missingCheckout && <Flag tone="danger">missing out</Flag>}
                                  {f.locationUnavailable && <Flag tone="muted">no location</Flag>}
                                  {f.adminAdjusted && <Flag tone="gold" title={s.admin_note ?? ''}>adjusted</Flag>}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => setFixing(s)}
                                  className="text-xs text-accent-300 hover:text-accent-400"
                                >
                                  {s.check_out_at ? 'Adjust' : 'Close'}
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {fixing && (
        <FixSheet
          session={fixing}
          employeeName={firstName(
            empById.get(fixing.employee_id)?.full_name ?? null,
            empById.get(fixing.employee_id)?.email ?? '',
          )}
          onClose={() => setFixing(null)}
          onSaved={() => {
            setFixing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function Flag({
  children,
  tone,
  title,
}: {
  children: React.ReactNode
  tone: 'danger' | 'muted' | 'gold'
  title?: string
}) {
  const cls =
    tone === 'danger'
      ? 'text-danger-fg bg-danger-tint'
      : tone === 'gold'
        ? 'text-gold bg-gold-tint'
        : 'text-fg-3 bg-dusk-700'
  return (
    <span
      title={title}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}
    >
      {children}
    </span>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="text-xs">
      <span className="mb-1 block uppercase tracking-wide text-fg-3">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-edge-strong bg-dusk-900 px-3 py-2 text-sm text-fg [color-scheme:dark] focus:border-accent-500 focus:outline-none"
      />
    </label>
  )
}

// Close a forgotten session or adjust a checkout time — always with a note.
function FixSheet({
  session,
  employeeName,
  onClose,
  onSaved,
}: {
  session: AttendanceSession
  employeeName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [note, setNote] = useState(session.admin_note ?? '')
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [outAt, setOutAt] = useState(() =>
    inTz(session.check_out_at ?? new Date()).format('YYYY-MM-DDTHH:mm'),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!note.trim()) {
      setError('A note is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // The entered wall-clock time is display-tz local; convert to a UTC instant.
      const outIso = useCustomTime
        ? fromDisplayTz(outAt).toISOString()
        : undefined
      await adminCloseSession(session.id, note.trim(), outIso)
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
        <div>
          <h2 className="text-display text-lg font-bold">
            {session.check_out_at ? 'Adjust session' : 'Close forgotten session'}
          </h2>
          <p className="mt-1 text-sm text-fg-3">
            {employeeName} · checked in {fmtDateTime(session.check_in_at)}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input
            type="checkbox"
            checked={useCustomTime}
            onChange={(e) => setUseCustomTime(e.target.checked)}
            className="accent-accent-500"
          />
          Set a specific checkout time
        </label>
        {useCustomTime ? (
          <input
            type="datetime-local"
            value={outAt}
            onChange={(e) => setOutAt(e.target.value)}
            className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg [color-scheme:dark] focus:border-accent-500 focus:outline-none"
          />
        ) : (
          <p className="text-xs text-fg-3">
            Checkout will be set to the current server time.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
            Note (required — shown in both apps)
          </span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Forgot to check out — closed at end of shift."
            className="w-full resize-none rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
          />
        </label>

        {error && <Notice>{error}</Notice>}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : 'Save correction'}
          </Button>
        </div>
      </form>
    </div>
  )
}
