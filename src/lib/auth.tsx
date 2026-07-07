import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
//  error        — signed in, but resolving the employee row failed transiently
//                 (network / 5xx / refresh race). Retryable — NOT "unregistered".
//  unregistered — authenticated, but the email is not an active employee
//  employee     — active, non-admin
//  admin        — active, is_admin
export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'error'; email: string }
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
    // A failed query (network / 5xx / refresh race) is NOT the same as "no such
    // employee". Surface a retryable error so a valid user isn't wrongly walled
    // out at the "not registered" screen.
    return { status: 'error', email }
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

  // Monotonic token: every state transition claims an id, and a resolve only
  // applies if it's still the latest. Prevents an in-flight authenticated
  // resolve from clobbering a later sign-out (out-of-order completion).
  const seq = useRef(0)

  const load = useCallback(async () => {
    const id = ++seq.current
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const next = await resolveState(session)
    if (seq.current === id) setState(next)
  }, [])

  useEffect(() => {
    load()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = ++seq.current
      resolveState(session).then((next) => {
        if (seq.current === id) setState(next)
      })
    })
    return () => subscription.unsubscribe()
  }, [load])

  const signOut = useCallback(async () => {
    seq.current++ // invalidate any in-flight resolve
    await supabase.auth.signOut()
    seq.current++ // and the SIGNED_OUT resolve races to the same anonymous result
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
