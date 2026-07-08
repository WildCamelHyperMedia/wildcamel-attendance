import { useState, type FormEvent } from 'react'
import { supabase, errorMessage } from '../lib/supabase'
import { Button, Notice } from './ui'

// Lets a signed-in user set their own password (e.g. change the temporary one
// the admin created their account with). No email needed — updateUser acts on
// the current session.
export function ChangePassword({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (pw !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setDone(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-t-2xl border border-edge bg-dusk-800 p-5 sm:rounded-2xl"
      >
        <h2 className="text-display text-lg font-bold">Change password</h2>
        {done ? (
          <>
            <Notice tone="info">Password updated. Use it next time you sign in.</Notice>
            <Button type="button" className="w-full" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Field label="New password" value={pw} onChange={setPw} autoFocus />
            <Field label="Confirm new password" value={confirm} onChange={setConfirm} />
            {error && <Notice>{error}</Notice>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-fg-3">
        {label}
      </span>
      <input
        type="password"
        autoComplete="new-password"
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-edge-strong bg-dusk-900 px-3.5 py-2.5 text-sm text-fg focus:border-accent-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
