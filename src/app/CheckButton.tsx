import { useCallback, useEffect, useRef, useState } from 'react'
import { Spinner } from '../components/ui'

// The check-in ritual.
//  - Checked OUT: a solid accent slab. One tap checks in.
//  - Checked IN:  press-and-hold. The six-stop sunset gradient fills the button
//    left-to-right like a fuse over ~900ms; releasing early cancels, so a
//    pocket tap can never end a shift.
const HOLD_MS = 900

export function CheckInButton({
  busy,
  onCheckIn,
}: {
  busy: boolean
  onCheckIn: () => void
}) {
  return (
    <button
      onClick={onCheckIn}
      disabled={busy}
      className="text-display group relative flex h-20 w-full items-center justify-center overflow-hidden rounded-2xl bg-accent-500 text-2xl font-bold tracking-wider text-white transition-colors hover:bg-accent-400 active:bg-accent-600 disabled:opacity-70"
    >
      {busy ? <Spinner className="size-7" /> : 'Check In'}
    </button>
  )
}

export function CheckOutButton({
  busy,
  onCheckOut,
}: {
  busy: boolean
  onCheckOut: () => void
}) {
  const [progress, setProgress] = useState(0) // 0..1
  const raf = useRef<number | null>(null)
  const start = useRef<number | null>(null)
  const fired = useRef(false)

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    start.current = null
    if (!fired.current) setProgress(0)
  }, [])

  const tick = useCallback(
    (t: number) => {
      if (start.current == null) start.current = t
      const p = Math.min(1, (t - start.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        if (!fired.current) {
          fired.current = true
          onCheckOut()
        }
        return
      }
      raf.current = requestAnimationFrame(tick)
    },
    [onCheckOut],
  )

  const begin = useCallback(() => {
    // Re-entrant guard: a second pointer (multi-touch) must not start a second
    // RAF loop, or an orphaned loop could fire onCheckOut after release.
    if (busy || fired.current || raf.current != null) return
    start.current = null
    raf.current = requestAnimationFrame(tick)
  }, [busy, tick])

  useEffect(() => {
    // When a checkout attempt ends (success or failure) and busy clears, reset
    // the latch AND the fill so a failed checkout doesn't leave the button stuck
    // full at "Keep holding…". (On success the component unmounts anyway.)
    if (!busy) {
      fired.current = false
      setProgress(0)
    }
  }, [busy])

  useEffect(() => () => stop(), [stop])

  return (
    <button
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      disabled={busy}
      aria-label="Press and hold to check out"
      className="text-display relative flex h-20 w-full touch-none select-none items-center justify-center overflow-hidden rounded-2xl border-2 border-edge-strong bg-dusk-800 text-2xl font-bold tracking-wider text-fg transition-colors disabled:opacity-70"
    >
      {/* Gradient fuse fill */}
      <span
        aria-hidden
        className="absolute inset-0 origin-left"
        style={{
          background: 'var(--spectrum)',
          transform: `scaleX(${progress})`,
          opacity: 0.9,
        }}
      />
      <span className="relative flex items-center gap-2 mix-blend-difference">
        {busy ? (
          <Spinner className="size-7" />
        ) : progress > 0 ? (
          'Keep holding…'
        ) : (
          'Hold to Check Out'
        )}
      </span>
    </button>
  )
}
