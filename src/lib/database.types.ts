// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If the schema changes, update both together.

export type LocationContext = 'office' | 'remote' | 'unknown'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high'

export interface Employee {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  active: boolean
  office_only: boolean
  created_at: string
}

export interface AttendanceSession {
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

export interface AppSettings {
  id: number
  office_lat: number | null
  office_lng: number | null
  office_radius_m: number
  display_tz: string
}

export interface Task {
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

export interface Database {
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
        Insert: never // writes only via RPCs
        Update: never
        Relationships: []
      }
      app_settings: {
        Row: AppSettings
        Insert: never
        Update: Partial<Omit<AppSettings, 'id'>>
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: Partial<Task> &
          Pick<Task, 'title' | 'assigned_to' | 'created_by'>
        Update: Partial<Task>
        Relationships: []
      }
    }
    Views: Record<string, never>
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
      me: { Args: Record<string, never>; Returns: string | null }
      is_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
