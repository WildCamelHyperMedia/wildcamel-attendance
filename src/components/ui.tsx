import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LocationContext } from '../lib/database.types'
import { contextLabel } from '../lib/format'
import camelDusk from '../assets/brand/camel-dusk.png'

// ---- Spectrum strand -------------------------------------------------------
export function SpectrumStrand({ className = '' }: { className?: string }) {
  return <div className={`spectrum-strand w-full ${className}`} aria-hidden />
}

// ---- Buttons ---------------------------------------------------------------
type Variant = 'accent' | 'ghost' | 'danger' | 'subtle'

const variantClasses: Record<Variant, string> = {
  accent:
    'bg-accent-500 text-white hover:bg-accent-400 active:bg-accent-600 disabled:bg-dusk-700 disabled:text-fg-3',
  ghost:
    'bg-transparent text-fg-2 border border-edge-strong hover:bg-dusk-700 hover:text-fg',
  danger:
    'bg-transparent text-danger-fg border border-[#5a2230] hover:bg-danger-tint',
  subtle: 'bg-dusk-700 text-fg-2 hover:bg-dusk-600 hover:text-fg',
}

export function Button({
  variant = 'accent',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---- Card ------------------------------------------------------------------
export function Card({
  children,
  className = '',
  strand = false,
}: {
  children: ReactNode
  className?: string
  strand?: boolean
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-edge bg-dusk-800 ${className}`}
    >
      {strand && <SpectrumStrand />}
      <div className={strand ? 'p-5' : ''}>{strand ? children : <div className="p-5">{children}</div>}</div>
    </div>
  )
}

// ---- Context badge (Office / Remote / Unknown) -----------------------------
// Wedge-cut chip echoing the wordmark's angular cuts. Colors are status hues
// deliberately distinct from the violet interactive accent.
const badgeStyles: Record<LocationContext, string> = {
  office: 'text-gold bg-gold-tint border border-[#5a4620]',
  remote: 'text-remote bg-remote-tint border border-[#4a2352]',
  unknown: 'text-fg-3 bg-unknown-tint border border-dashed border-edge-strong',
}

export function ContextBadge({ ctx }: { ctx: LocationContext | null }) {
  const key = ctx ?? 'unknown'
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badgeStyles[key]}`}
      style={{ clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 0 100%)' }}
    >
      {contextLabel(ctx)}
    </span>
  )
}

// ---- Spinner ---------------------------------------------------------------
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-fg-3">
      <Spinner className="text-accent-400 size-6" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// ---- Empty state -----------------------------------------------------------
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-edge bg-dusk-800 px-6 py-12 text-center">
      <img
        src={camelDusk}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-8 -bottom-10 h-52 opacity-[0.07] select-none"
      />
      <p className="text-display relative text-lg font-bold text-fg-2">{title}</p>
      {hint && <p className="relative mt-1 max-w-xs text-sm text-fg-3">{hint}</p>}
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  )
}

// ---- Inline error / notice -------------------------------------------------
export function Notice({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'info'
  children: ReactNode
}) {
  const cls =
    tone === 'danger'
      ? 'text-danger-fg bg-danger-tint border-[#5a2230]'
      : 'text-accent-300 bg-accent-900 border-edge-strong'
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${cls}`} role="alert">
      {children}
    </div>
  )
}

// ---- Skeleton --------------------------------------------------------------
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-dusk-700 ${className}`} />
}
