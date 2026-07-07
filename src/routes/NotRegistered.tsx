import { useAuth } from '../lib/auth'
import { Button } from '../components/ui'
import camelDusk from '../assets/brand/camel-dusk.png'

// Shown when someone authenticates with an email that isn't an ACTIVE employee.
// They get access to nothing (RLS enforces this too); this is just the wall.
export default function NotRegistered({ email }: { email: string }) {
  const { signOut } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <img src={camelDusk} alt="" aria-hidden className="mb-6 h-28 opacity-80" />
      <h1 className="text-display text-2xl font-bold">This email isn't registered</h1>
      <p className="mt-3 max-w-sm text-sm text-fg-2">
        <span className="text-fg">{email}</span> isn't on the Wild Camel team list
        — or it was deactivated. Contact your admin to get access.
      </p>
      <Button variant="ghost" className="mt-8" onClick={signOut}>
        Sign out
      </Button>
    </div>
  )
}
