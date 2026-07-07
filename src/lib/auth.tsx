import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Employee } from './database.types'
import { setDisplayTz } from './time'

// Auth states:
//  loading      — resolving the session / employee row
//  anonymous    — no Supabase session
//  unregistered — authenticated, but the email is not an active employee
//  employee     — active, non-admin
//  admin        — active, is_admin
export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'unregistered'; email: string }
  | { status: 'employee'; employee: Employee; session: Session }
  | { status: 'admin'; employee: Employee; session: Session }

interface AuthContextValue {
  state: AuthState
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function resolveState(session: Session | null): Promise<AuthState> {
  if (!session) return { status: 'anonymous' }
  const email = session.user.email ?? ''

  // The employees SELECT policy returns our own row (even if inactive), so this
  // is the single source of truth for identity + role. Load display tz too.
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (error) {
    // Network/permission hiccup — treat as unregistered rather than crashing.
    return { status: 'unregistered', email }
  }
  if (!data || !data.active) {
    return { status: 'unregistered', email }
  }

  // Best-effort: pull display timezone for rendering (readable by employees).
  const { data: settings } = await supabase
    .from('app_settings')
    .select('display_tz')
    .maybeSingle()
  if (settings?.display_tz) setDisplayTz(settings.display_tz)

  return data.is_admin
    ? { status: 'admin', employee: data, session }
    : { status: 'employee', employee: data, session }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    setState(await resolveState(session))
  }, [])

  useEffect(() => {
    load()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveState(session).then(setState)
    })
    return () => subscription.unsubscribe()
  }, [load])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ status: 'anonymous' })
  }, [])

  return (
    <AuthContext.Provider value={{ state, refresh: load, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
