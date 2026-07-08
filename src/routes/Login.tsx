import { useState, type FormEvent } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { Button, Notice, SpectrumStrand, Spinner } from '../components/ui'
import lockupDusk from '../assets/brand/lockup-dusk.png'

// Everyone — employees and the admin (Rudy) — signs in with email + password.
// Auth accounts are created by the admin in the Supabase dashboard; the
// AuthProvider then routes by role (is_admin) from the employees table.
// (Passwordless magic links are the intended long-term flow but need a custom
// SMTP sender; see README to switch back once that's set up.)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setBusy(false)
    // On success, onAuthStateChange in AuthProvider swaps the whole view.
    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? 'Wrong email or password. Ask your admin if you need a reset.'
          : errorMessage(error),
      )
    }
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
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <h1 className="text-display text-xl font-bold">Sign in</h1>
              <p className="mt-1 text-sm text-fg-3">
                Enter your Wild Camel email and password.
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
        </div>
      </div>

      <p className="mt-6 max-w-xs text-center text-xs text-fg-3">
        Forgot your password? Ask Rudy — he can reset it for you.
      </p>
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
