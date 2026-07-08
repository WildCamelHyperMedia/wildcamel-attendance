import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { firstName } from '../lib/format'
import {
  checkIn,
  checkOut,
  fetchMySessions,
  fetchMyOpenSession,
  fetchTasks,
} from '../lib/api'
import type { AttendanceSession } from '../lib/database.types'
import { getPosition, type GeoFailure } from '../lib/geo'
import { errorMessage } from '../lib/supabase'
import { useNow } from '../lib/useNow'
import {
  dayKey,
  elapsedMs,
  fmtHours,
  fmtStopwatch,
  fmtTime,
  inTz,
} from '../lib/time'
import { Button, ContextBadge, Notice, Skeleton, SpectrumStrand } from '../components/ui'
import { EnableLocationHelp } from '../components/EnableLocationHelp'
import { CheckInButton, CheckOutButton } from './CheckButton'

// Short, actionable note shown when we couldn't read location at check-in/out.
function geoNoteFor(status: GeoFailure): string {
  switch (status) {
    case 'denied':
      return "Location is off for this site — you're marked Unknown."
    case 'unavailable':
      return "Couldn't get your location — Location Services may be off. You're marked Unknown."
    case 'timeout':
      return "Location took too long — you're marked Unknown."
    case 'unsupported':
      return "This browser can't share location — you're marked Unknown."
  }
}

export default function Home() {
  const { state } = useAuth()
  const employee = state.status === 'employee' || state.status === 'admin' ? state.employee : null

  const [open, setOpen] = useState<AttendanceSession | null>(null)
  const [today, setToday] = useState<AttendanceSession[]>([])
  const [openTaskCount, setOpenTaskCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoNote, setGeoNote] = useState<string | null>(null)
  const [geoFail, setGeoFail] = useState<GeoFailure | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const now = useNow(1000)

  const load = useCallback(async () => {
    setError(null)
    try {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const [openSession, sessions, tasks] = await Promise.all([
        fetchMyOpenSession(),
        fetchMySessions(),
        fetchTasks(),
      ])
      setOpen(openSession)
      const tKey = dayKey(new Date())
      setToday(sessions.filter((s) => dayKey(s.check_in_at) === tKey))
      setOpenTaskCount(
        tasks.filter((t) => t.assigned_to === employee?.id && t.status !== 'done').length,
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [employee?.id])

  useEffect(() => {
    load()
  }, [load])

  async function doCheckIn() {
    setBusy(true)
    setError(null)
    setGeoNote(null)
    setGeoFail(null)
    const geo = await getPosition()
    if (geo.status !== 'ok') {
      setGeoFail(geo.status)
      setGeoNote(geoNoteFor(geo.status))
    }
    try {
      const session = await checkIn(geo.status === 'ok' ? geo.coords : null)
      setOpen(session)
      await load()
    } catch (e) {
      // office_only employees get a thrown error here when not at the office;
      // keep the Fix/Try-again buttons visible so they can enable location.
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function doCheckOut() {
    setBusy(true)
    setError(null)
    setGeoNote(null)
    setGeoFail(null)
    const geo = await getPosition()
    if (geo.status !== 'ok') {
      setGeoFail(geo.status)
      setGeoNote(geoNoteFor(geo.status))
    }
    try {
      await checkOut(geo.status === 'ok' ? geo.coords : null)
      setOpen(null)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Re-read location after the user has (hopefully) enabled it, without forcing
  // a fresh check-in. The already-recorded session keeps its label, but this
  // confirms location works so the next check-in is correct.
  async function retryLocation() {
    setBusy(true)
    const geo = await getPosition()
    if (geo.status === 'ok') {
      setGeoFail(null)
      setGeoNote('Location is on now — your next check-in will be labelled correctly.')
      setHelpOpen(false)
    } else {
      setGeoFail(geo.status)
      setGeoNote(geoNoteFor(geo.status))
    }
    setBusy(false)
  }

  // The live shift timer shows the full elapsed time since check-in.
  const liveMs = open ? elapsedMs(open.check_in_at, new Date(now)) : 0

  // "Worked today" = closed sessions today + only TODAY'S portion of the open
  // session (so a shift left open overnight doesn't inflate today's total).
  const startOfTodayMs = inTz(new Date(now)).startOf('day').valueOf()
  const liveTodayMs = open
    ? Math.max(0, now - Math.max(new Date(open.check_in_at).getTime(), startOfTodayMs))
    : 0
  const closedMs = today
    .filter((s) => s.check_out_at)
    .reduce((sum, s) => sum + elapsedMs(s.check_in_at, s.check_out_at), 0)
  const totalTodayMs = closedMs + liveTodayMs

  const nowInTz = inTz(new Date(now))

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <p className="text-sm text-fg-3">{nowInTz.format('dddd D MMMM')}</p>
        <h1 className="text-display text-3xl font-bold">
          Good {greeting(nowInTz.hour())},{' '}
          {employee ? firstName(employee.full_name, employee.email) : ''}
        </h1>
      </header>

      {/* Check-in card */}
      <div className="overflow-hidden rounded-2xl border border-edge bg-dusk-800">
        <SpectrumStrand />
        <div className="space-y-4 p-5">
          {open ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-fg-3">On the clock</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-fg-2">
                    Since {fmtTime(open.check_in_at)}
                    <ContextBadge ctx={open.in_context} />
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-oasis">
                  <span className="size-2 animate-pulse rounded-full bg-oasis" />
                  Active
                </span>
              </div>
              <div className="py-2 text-center">
                <p className="font-mono text-5xl font-medium tabular-nums text-fg">
                  {fmtStopwatch(liveMs)}
                </p>
              </div>
              <CheckOutButton busy={busy} onCheckOut={doCheckOut} />
            </>
          ) : (
            <>
              <p className="text-sm text-fg-2">
                Ready when you are. Tap to start your shift.
              </p>
              <CheckInButton busy={busy} onCheckIn={doCheckIn} />
              <p className="text-xs leading-relaxed text-fg-3">
                Wild Camel records your location at check-in and check-out to label
                office vs remote days. You can decline — you'll just be marked
                Unknown.
              </p>
            </>
          )}
          {geoNote && <p className="text-xs text-gold">{geoNote}</p>}
          {geoFail && geoFail !== 'unsupported' && (
            <div className="flex gap-2">
              <Button variant="subtle" onClick={retryLocation} disabled={busy}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => setHelpOpen(true)} disabled={busy}>
                Fix location
              </Button>
            </div>
          )}
          {error && <Notice>{error}</Notice>}
        </div>
      </div>

      {helpOpen && geoFail && (
        <EnableLocationHelp
          reason={geoFail}
          onClose={() => setHelpOpen(false)}
          onRetry={retryLocation}
        />
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Worked today" value={fmtHours(totalTodayMs)} />
        <Link
          to="/app/tasks"
          className="rounded-2xl border border-edge bg-dusk-800 p-4 transition-colors hover:bg-dusk-700"
        >
          <p className="text-xs uppercase tracking-wide text-fg-3">Open tasks</p>
          <p className="text-display mt-1 text-2xl font-bold text-fg">
            {openTaskCount ?? '—'}
          </p>
        </Link>
      </div>

      {/* Today's sessions */}
      <section>
        <h2 className="text-display mb-2 text-sm font-bold tracking-wide text-fg-2">
          Today's sessions
        </h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : today.length === 0 ? (
          <p className="rounded-xl border border-edge bg-dusk-800 px-4 py-6 text-center text-sm text-fg-3">
            No sessions yet today.
          </p>
        ) : (
          <ul className="space-y-2">
            {today.map((s) => (
              <SessionRow key={s.id} s={s} now={now} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function greeting(hour: number) {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-dusk-800 p-4">
      <p className="text-xs uppercase tracking-wide text-fg-3">{label}</p>
      <p className="text-display mt-1 text-2xl font-bold text-fg">{value}</p>
    </div>
  )
}

function SessionRow({ s, now }: { s: AttendanceSession; now: number }) {
  const ms = elapsedMs(s.check_in_at, s.check_out_at ?? new Date(now))
  return (
    <li className="flex items-center justify-between rounded-xl border border-edge bg-dusk-800 px-4 py-3">
      <div className="flex items-center gap-3">
        <ContextBadge ctx={s.in_context} />
        <span className="font-mono text-sm text-fg-2 tabular-nums">
          {fmtTime(s.check_in_at)} –{' '}
          {s.check_out_at ? fmtTime(s.check_out_at) : <span className="text-oasis">now</span>}
        </span>
      </div>
      <span className="text-sm font-medium text-fg">{fmtHours(ms)}</span>
    </li>
  )
}
