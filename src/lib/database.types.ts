// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If the schema changes, update both together.

export type LocationContext = 'office' | 'remote' | 'unknown'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high'

// NB: these are `type` aliases, not `interface`s — supabase-js requires the
// Row/Insert/Update shapes to be assignable to Record<string, unknown>, and
// interfaces (unlike type aliases) lack the implicit index signature needed for
// that, which would silently collapse the whole typed client to `never`.
export type Employee = {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  active: boolean
  office_only: boolean
  created_at: string
}

export type AttendanceSession = {
  id: string
  employee_id: string
  check_in_at: string
  check_out_at: string | null
  in_lat: number | null
  in_lng: number | null
  in_accuracy_m: number | null
  out_lat: number | null
  out_lng: number | null
  out_accuracy_m: number | null
  in_context: LocationContext | null
  out_context: LocationContext | null
  admin_note: string | null
  created_at: string
}

export type AppSettings = {
  id: number
  office_lat: number | null
  office_lng: number | null
  office_radius_m: number
  display_tz: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  assigned_to: string
  created_by: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export type PushSubscriptionRow = {
  id: string
  employee_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}

// Note: attendance_sessions and app_settings inserts/deletes are blocked at the
// database (RLS + revoked privileges). The Insert/Update shapes below exist only
// for the type-checker; the server is the real enforcement boundary.
export type Database = {
  public: {
    Tables: {
      employees: {
        Row: Employee
        Insert: Partial<Employee> & Pick<Employee, 'email'>
        Update: Partial<Employee>
        Relationships: []
      }
      attendance_sessions: {
        Row: AttendanceSession
        Insert: Partial<AttendanceSession> & Pick<AttendanceSession, 'employee_id'>
        Update: Partial<AttendanceSession>
        Relationships: []
      }
      app_settings: {
        Row: AppSettings
        Insert: Partial<AppSettings>
        Update: Partial<Omit<AppSettings, 'id'>>
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: Partial<Task> & Pick<Task, 'title' | 'assigned_to' | 'created_by'>
        Update: Partial<Task>
        Relationships: []
      }
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Partial<PushSubscriptionRow> &
          Pick<PushSubscriptionRow, 'employee_id' | 'endpoint' | 'p256dh' | 'auth'>
        Update: Partial<PushSubscriptionRow>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      check_in: {
        Args: { lat?: number | null; lng?: number | null; accuracy_m?: number | null }
        Returns: AttendanceSession
      }
      check_out: {
        Args: { lat?: number | null; lng?: number | null; accuracy_m?: number | null }
        Returns: AttendanceSession
      }
      admin_close_session: {
        Args: { session_id: string; note: string; out_at?: string | null }
        Returns: AttendanceSession
      }
      me: { Args: Record<never, never>; Returns: string | null }
      is_admin: { Args: Record<never, never>; Returns: boolean }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
