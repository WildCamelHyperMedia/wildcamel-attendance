import { supabase } from './supabase'
import type {
  AttendanceSession,
  Task,
  TaskStatus,
  Employee,
  AppSettings,
} from './database.types'
import type { Coords } from './geo'

// Thin typed wrappers over the RPCs and RLS-scoped table reads. Every call here
// is subject to the database's RLS/RPC rules — the client cannot exceed them.

export async function checkIn(coords: Coords | null): Promise<AttendanceSession> {
  const { data, error } = await supabase.rpc('check_in', {
    lat: coords?.lat ?? undefined,
    lng: coords?.lng ?? undefined,
    accuracy_m: coords?.accuracy_m ?? undefined,
  })
  if (error) throw error
  return data as AttendanceSession
}

export async function checkOut(coords: Coords | null): Promise<AttendanceSession> {
  const { data, error } = await supabase.rpc('check_out', {
    lat: coords?.lat ?? undefined,
    lng: coords?.lng ?? undefined,
    accuracy_m: coords?.accuracy_m ?? undefined,
  })
  if (error) throw error
  return data as AttendanceSession
}

export async function adminCloseSession(
  sessionId: string,
  note: string,
  outAt?: string,
): Promise<AttendanceSession> {
  const { data, error } = await supabase.rpc('admin_close_session', {
    session_id: sessionId,
    note,
    out_at: outAt ?? undefined,
  })
  if (error) throw error
  return data as AttendanceSession
}

/** My own sessions between two ISO instants (inclusive of the day range). */
export async function fetchMySessions(
  fromIso?: string,
  toIso?: string,
): Promise<AttendanceSession[]> {
  let q = supabase
    .from('attendance_sessions')
    .select('*')
    .order('check_in_at', { ascending: false })
  if (fromIso) q = q.gte('check_in_at', fromIso)
  if (toIso) q = q.lte('check_in_at', toIso)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

/** Admin: all sessions in a window (RLS lets admin see everyone). */
export async function fetchAllSessions(
  fromIso?: string,
  toIso?: string,
): Promise<AttendanceSession[]> {
  let q = supabase
    .from('attendance_sessions')
    .select('*')
    .order('check_in_at', { ascending: false })
  if (fromIso) q = q.gte('check_in_at', fromIso)
  if (toIso) q = q.lte('check_in_at', toIso)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function fetchMyOpenSession(): Promise<AttendanceSession | null> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .is('check_out_at', null)
    .order('check_in_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

// ---- Employees -------------------------------------------------------------
export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('is_admin', { ascending: false })
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addEmployee(
  email: string,
  fullName: string,
  officeOnly = false,
): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .insert({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim() || null,
      office_only: officeOnly,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEmployee(
  id: string,
  patch: Partial<Pick<Employee, 'active' | 'office_only' | 'full_name'>>,
): Promise<void> {
  const { error } = await supabase.from('employees').update(patch).eq('id', id)
  if (error) throw error
}

// ---- Settings --------------------------------------------------------------
export async function fetchSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase.from('app_settings').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function updateSettings(
  patch: Partial<Omit<AppSettings, 'id'>>,
): Promise<void> {
  const { error } = await supabase.from('app_settings').update(patch).eq('id', 1)
  if (error) throw error
}

// ---- Tasks -----------------------------------------------------------------
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  if (error) throw error
}

export interface TaskInput {
  title: string
  description?: string | null
  assigned_to: string
  created_by: string
  priority?: Task['priority']
  due_date?: string | null
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assigned_to: input.assigned_to,
      created_by: input.created_by,
      priority: input.priority ?? 'normal',
      due_date: input.due_date || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'due_date' | 'status' | 'assigned_to'>>,
): Promise<void> {
  const { error } = await supabase.from('tasks').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
