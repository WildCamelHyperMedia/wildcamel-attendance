import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchMySessions } from '../lib/api'
import type { AttendanceSession } from '../lib/database.types'
import { errorMessage } from '../lib/supabase'
import {
  dayKey,
  dayjs,
  elapsedMs,
  fmtDayKey,
  fmtHours,
  fmtTime,
  inTz,
} from '../lib/time'
import { ContextBadge, EmptyState, Notice, Skeleton } from '../components/ui'

// Group a flat session list into days (in display tz), newest first.
function groupByDay(sessions: AttendanceSession[]) {
  const map = new Map<string, AttendanceSession[]>()
  for (const s of sessions) {
    const k = dayKey(s.check_in_at)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(s)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

export default function History() {
  const [range, setRange] = useState<'7' | '30' | '90'>('30')
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = dayjs().subtract(Number(range), 'day').startOf('day').toISOString()
      setSessions(await fetchMySessions(from))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => groupByDay(sessions), [sessions])

  // Weekly totals (ISO week) for the summary strip.
  const weekTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (!s.check_out_at) continue
      const wk = inTz(s.check_in_at).startOf('isoWeek').format('YYYY-MM-DD')
      map.set(wk, (map.get(wk) ?? 0) + elapsedMs(s.check_in_at, s.check_out_at))
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 4)
  }, [sessions])

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-1">
        <h1 className="text-display text-2xl font-bold">History</h1>
        <div className="flex gap-1 rounded-lg border border-edge bg-dusk-800 p-0.5">
          {(['7', '30', '90'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r ? 'bg-accent-500 text-white' : 'text-fg-3 hover:text-fg-2'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </header>

      {error && <Notice>{error}</Notice>}

      {weekTotals.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {weekTotals.map(([wk, ms]) => (
            <div
              key={wk}
              className="min-w-[110px] shrink-0 rounded-xl border border-edge bg-dusk-800 px-3 py-2"
            >
              <p className="text-[11px] text-fg-3">
                Week of {fmtDayKey(wk, 'D MMM')}
              </p>
              <p className="text-display text-lg font-bold text-fg">{fmtHours(ms)}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : days.length === 0 ? (
        <EmptyState title="No sessions in range" hint="Try a wider date range, or check in from the Home tab." />
      ) : (
        <div className="space-y-4">
          {days.map(([day, daySessions]) => {
            const dayMs = daySessions
              .filter((s) => s.check_out_at)
              .reduce((sum, s) => sum + elapsedMs(s.check_in_at, s.check_out_at), 0)
            const hasOpen = daySessions.some((s) => !s.check_out_at)
            return (
              <section key={day}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-fg-2">
                    {fmtDayKey(day)}
                  </h2>
                  <span className="text-sm font-medium text-fg">
                    {fmtHours(dayMs)}
                    {hasOpen && <span className="ml-1 text-xs text-oasis">+ open</span>}
                  </span>
                </div>
                <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-dusk-800">
                  {daySessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ContextBadge ctx={s.in_context} />
                        <span className="font-mono text-sm text-fg-2 tabular-nums">
                          {fmtTime(s.check_in_at)} –{' '}
                          {s.check_out_at ? (
                            fmtTime(s.check_out_at)
                          ) : (
                            <span className="text-oasis">open</span>
                          )}
                        </span>
                        {s.admin_note && (
                          <span
                            className="text-[11px] font-medium text-gold"
                            title={s.admin_note}
                          >
                            • edited by admin
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-fg">
                        {s.check_out_at
                          ? fmtHours(elapsedMs(s.check_in_at, s.check_out_at))
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
