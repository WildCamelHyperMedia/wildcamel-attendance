import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.extend(isoWeek)

// All timestamps are stored in UTC (timestamptz). Everything the user SEES is
// rendered in the org's display timezone from app_settings (default Asia/Dubai).

let displayTz = 'Asia/Dubai'
export function setDisplayTz(tz: string) {
  if (tz) displayTz = tz
}
export function getDisplayTz() {
  return displayTz
}

export function inTz(iso: string | Date) {
  return dayjs(iso).tz(displayTz)
}

/** e.g. "09:32" */
export function fmtTime(iso: string | Date) {
  return inTz(iso).format('HH:mm')
}

/** e.g. "Mon 7 Jul" */
export function fmtDate(iso: string | Date) {
  return inTz(iso).format('ddd D MMM')
}

/** e.g. "Mon 7 Jul, 09:32" */
export function fmtDateTime(iso: string | Date) {
  return inTz(iso).format('ddd D MMM, HH:mm')
}

/** YYYY-MM-DD in the display tz — the key used to group sessions by day. */
export function dayKey(iso: string | Date) {
  return inTz(iso).format('YYYY-MM-DD')
}

/** Elapsed ms between two instants (or now). */
export function elapsedMs(from: string | Date, to: string | Date | null = null) {
  return dayjs(to ?? undefined).diff(dayjs(from))
}

/** Live timer readout "H:MM:SS" (no leading day cap — a forgotten session can run long). */
export function fmtStopwatch(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return `${h}:${mm}:${ss}`
}

/** Compact hours label, e.g. "7h 32m" or "0m". */
export function fmtHours(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Decimal hours for CSV, e.g. 7.53 */
export function decimalHours(ms: number) {
  return Math.round((ms / 3600000) * 100) / 100
}

export { dayjs }
