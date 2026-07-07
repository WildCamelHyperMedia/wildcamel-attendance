import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Button, LoadingScreen } from './components/ui'
import Login from './routes/Login'
import NotRegistered from './routes/NotRegistered'
import AppLayout from './app/AppLayout'
import Home from './app/Home'
import History from './app/History'
import Tasks from './app/Tasks'
import AdminLayout from './admin/AdminLayout'
import LiveBoard from './admin/LiveBoard'
import Records from './admin/Records'
import Employees from './admin/Employees'
import AdminTasks from './admin/AdminTasks'
import Settings from './admin/Settings'

function Routed() {
  const { state } = useAuth()

  if (state.status === 'loading') return <LoadingScreen label="Signing you in…" />
  if (state.status === 'anonymous') return <Login />
  if (state.status === 'error') return <ConnectionError email={state.email} />
  if (state.status === 'unregistered') return <NotRegistered email={state.email} />

  const isAdmin = state.status === 'admin'

  return (
    <Routes>
      {/* Employee area (admins can use it too) */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="history" element={<History />} />
        <Route path="tasks" element={<Tasks />} />
      </Route>

      {/* Admin area — gated by role. Non-admins are redirected out. */}
      <Route
        path="/admin"
        element={isAdmin ? <AdminLayout /> : <Navigate to="/app" replace />}
      >
        <Route index element={<LiveBoard />} />
        <Route path="records" element={<Records />} />
        <Route path="employees" element={<Employees />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Default landing by role */}
      <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/app'} replace />} />
    </Routes>
  )
}

// Shown when we're signed in but couldn't load the employee row (transient
// network / server error). Retryable — never assumes the user isn't registered.
function ConnectionError({ email }: { email: string }) {
  const { refresh, signOut } = useAuth()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-display text-2xl font-bold">Couldn't connect</h1>
      <p className="max-w-sm text-sm text-fg-2">
        We signed you in as <span className="text-fg">{email}</span> but couldn't
        reach the server to load your account. Check your connection and try again.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => refresh()}>Try again</Button>
        <Button variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  )
}

