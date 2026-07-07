import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import camelDusk from '../assets/brand/camel-dusk.png'

const tabs = [
  { to: '/app', label: 'Home', end: true, icon: HomeIcon },
  { to: '/app/history', label: 'History', end: false, icon: ClockIcon },
  { to: '/app/tasks', label: 'Tasks', end: false, icon: ListIcon },
]

export default function AppLayout() {
  const { state, signOut } = useAuth()
  const location = useLocation()
  const isAdmin = state.status === 'admin'

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-edge bg-dusk-900/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src={camelDusk} alt="Wild Camel" className="h-7" />
          <span className="text-display text-sm font-bold tracking-wide text-fg-2">
            Wild Camel
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <NavLink
              to="/admin"
              className="rounded-md border border-edge-strong px-2.5 py-1 text-xs font-medium text-accent-300 hover:bg-dusk-700"
            >
              Admin
            </NavLink>
          )}
          <button
            onClick={signOut}
            className="text-xs text-fg-3 hover:text-fg-2"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pt-4 pb-24">
        <Outlet key={location.pathname} />
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-edge bg-dusk-900/95 backdrop-blur">
        <div className="grid grid-cols-3 pb-[env(safe-area-inset-bottom)]">
          {tabs.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-accent-300' : 'text-fg-3 hover:text-fg-2'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon active={isActive} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
