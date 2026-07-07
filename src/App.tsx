import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { LoadingScreen } from './components/ui'
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

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  )
}
