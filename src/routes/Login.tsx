import { useState, type FormEvent } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { Button, Notice, SpectrumStrand, Spinner } from '../components/ui'
import lockupDusk from '../assets/brand/lockup-dusk.png'

// Employees sign in with a passwordless magic link. Rudy (admin) has a small
// "admin" toggle revealing an email + password form. Both land back on this
// origin; the AuthProvider then routes by role.

type Mode = 'employee' | 'admin'

export default function Login() {
  const [mode, setMode] = useState<Mode>('employee')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const redirectTo = window.location.origin + window.location.pathname

  async function sendMagicLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // shouldCreateUser must be true: an employee's Supabase auth account is
      // created on their first magic-link click. Authorization is NOT done here
      // — it's the employees allowlist enforced by RLS (a non-allowlisted email
      // authenticates fine but sees the "not registered" screen and can read
      // nothing). Requires "Allow new users to sign up" = ON in Supabase Auth.
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setSent(true)
  }

  async function signInAdmin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setBusy(false)
    // On success, onAuthStateChange in AuthProvider swaps the whole view.
    if (error) setError(errorMessage(error))
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <img
        src={lockupDusk}
        alt="Wild Camel"
        className="mb-10 w-full max-w-[280px] select-none"
        draggable={false}
      />

      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-edge bg-dusk-800">
        <SpectrumStrand />
        <div className="p-6">
          {mode === 'employee' ? (
            sent ? (
              <div className="text-center">
                <h1 className="text-display text-xl font-bold">Check your email</h1>
                <p className="mt-2 text-sm text-fg-2">
                  We sent a sign-in link to{' '}
                  <span className="text-fg">{email.trim().toLowerCase()}</span>. Open
                  it on this device to continue.
                </p>
                <button
                  className="mt-5 text-sm text-accent-300 hover:text-accent-400"
                  onClick={() => {
                    setSent(false)
                    setEmail('')
                  }}
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={sendMagicLink} className="space-y-4">
                <div>
                  <h1 className="text-display text-xl font-bold">Sign in</h1>
                  <p className="mt-1 text-sm text-fg-3">
                    Enter your Wild Camel email — we'll send you a one-tap sign-in
                    link. No password needed.
                  </p>
                </div>
                <Field
                  label="Work email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@wildcamel.tv"
                  value={email}
                  onChange={setEmail}
                  required
                />
                {error && <Notice>{error}</Notice>}
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? <Spinner /> : 'Send magic link'}
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={signInAdmin} className="space-y-4">
              <div>
                <h1 className="text-display text-xl font-bold">Admin sign in</h1>
                <p className="mt-1 text-sm text-fg-3">
                  For the owner account. Employees should use the magic link.
                </p>
              </div>
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                required
              />
              <Field
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                required
              />
              {error && <Notice>{error}</Notice>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Spinner /> : 'Sign in'}
              </Button>
            </form>
          )}
        </div>
      </div>

      <button
        className="mt-6 text-xs text-fg-3 hover:text-fg-2"
        onClick={() => {
          setMode(mode === 'employee' ? 'admin' : 'employee')
          setError(null)
          setSent(false)
        }}
      >
        {mode === 'employee' ? 'Admin sign in' : '← Employee sign in'}
      </button>
    </div>
  )
}

function Field({
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
        className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:border-accent-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </label>
  )
}
