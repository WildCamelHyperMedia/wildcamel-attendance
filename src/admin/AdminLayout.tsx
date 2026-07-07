import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { firstName } from '../lib/format'
import { SpectrumStrand } from '../components/ui'
import wordmarkWhite from '../assets/brand/wordmark-white.png'
import camelDusk from '../assets/brand/camel-dusk.png'

const nav = [
  { to: '/admin', label: 'Live board', end: true },
  { to: '/admin/records', label: 'Records', end: false },
  { to: '/admin/tasks', label: 'Tasks', end: false },
  { to: '/admin/employees', label: 'Employees', end: false },
  { to: '/admin/settings', label: 'Settings', end: false },
]

export default function AdminLayout() {
  const { state, signOut } = useAuth()
  const location = useLocation()
  const employee = state.status === 'admin' ? state.employee : null

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (desktop) / top nav (mobile) */}
      <aside className="border-b border-edge bg-dusk-950 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <img src={wordmarkWhite} alt="Wild Camel" className="h-6 lg:h-7" />
          <SpectrumStrand className="mt-3 hidden lg:block" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-3">
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors lg:w-full ${
                  isActive
                    ? 'bg-accent-900 text-accent-300'
                    : 'text-fg-3 hover:bg-dusk-800 hover:text-fg-2'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-edge p-4 lg:block">
          <div className="flex items-center gap-2">
            <img src={camelDusk} alt="" className="h-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                {employee ? firstName(employee.full_name, employee.email) : 'Admin'}
              </p>
              <button onClick={signOut} className="text-xs text-fg-3 hover:text-fg-2">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8 lg:py-8">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <span className="text-display text-sm font-bold text-fg-2">Admin</span>
            <button onClick={signOut} className="text-xs text-fg-3 hover:text-fg-2">
              Sign out
            </button>
          </div>
          <Outlet key={location.pathname} />
        </div>
      </main>
    </div>
  )
}
