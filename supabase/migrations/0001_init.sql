-- ============================================================================
-- Wild Camel Attendance — initial schema
-- ============================================================================
-- Run this whole file once in the Supabase SQL Editor.
--
-- Security model (the whole point of this file):
--   * The frontend is a static site holding only the anon key, so EVERY
--     security guarantee lives here: RLS on all tables + SECURITY DEFINER
--     RPCs as the only write path for attendance.
--   * Timestamps come exclusively from Postgres now() inside the RPCs.
--     No code path accepts a client-supplied clock for check-in/out.
--   * Employees are identified by the verified email in their JWT
--     (auth.jwt() ->> 'email'), matched against the employees allowlist.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null check (email = lower(email)),
  full_name   text,
  is_admin    boolean not null default false,
  active      boolean not null default true,
  office_only boolean not null default false, -- may only check in near the office
  created_at  timestamptz not null default now()
);

create table public.attendance_sessions (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees (id),
  check_in_at    timestamptz not null default now(),
  check_out_at   timestamptz,
  in_lat         double precision,
  in_lng         double precision,
  in_accuracy_m  numeric,
  out_lat        double precision,
  out_lng        double precision,
  out_accuracy_m numeric,
  in_context     text check (in_context in ('office', 'remote', 'unknown')),
  out_context    text check (out_context in ('office', 'remote', 'unknown')),
  admin_note     text, -- set only when an admin corrects/closes a session
  created_at     timestamptz not null default now(),
  constraint checkout_after_checkin
    check (check_out_at is null or check_out_at >= check_in_at)
);

-- At most ONE open session per employee.
create unique index one_open_session_per_employee
  on public.attendance_sessions (employee_id)
  where check_out_at is null;

create index attendance_by_employee_time
  on public.attendance_sessions (employee_id, check_in_at desc);
create index attendance_by_time
  on public.attendance_sessions (check_in_at desc);

create table public.app_settings (
  id              integer primary key default 1 check (id = 1), -- single row
  office_lat      double precision,
  office_lng      double precision,
  office_radius_m integer not null default 150 check (office_radius_m > 0),
  display_tz      text not null default 'Asia/Dubai'
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  description  text,
  assigned_to  uuid not null references public.employees (id),
  created_by   uuid not null references public.employees (id),
  status       text not null default 'todo'
               check (status in ('todo', 'in_progress', 'done')),
  priority     text not null default 'normal'
               check (priority in ('low', 'normal', 'high')),
  due_date     date,
  completed_at timestamptz, -- managed by trigger, never by clients
  created_at   timestamptz not null default now()
);

create index tasks_by_assignee on public.tasks (assigned_to, status);
create index tasks_by_creator on public.tasks (created_by);

-- ----------------------------------------------------------------------------
-- 2. Identity helpers
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so they can read employees without tripping RLS recursion
-- (policies on employees itself call is_admin()). search_path is pinned and
-- empty; every object reference is schema-qualified.

create or replace function public.jwt_email()
returns text
language sql stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- The caller's employee id — null when not an ACTIVE allowlisted employee.
create or replace function public.me()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.employees
  where email = public.jwt_email() and active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.employees
     where email = public.jwt_email() and active),
    false)
$$;

-- Great-circle distance in meters (haversine).
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable
set search_path = ''
as $$
  select 2 * 6371000.0 * asin( least(1.0, sqrt(
    pow(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
      * pow(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- Classify a coordinate pair against the configured office location.
-- NOTE: browser geolocation is user-spoofable and Wi-Fi SSID cannot be read
-- from a browser, so office/remote context is informational deterrence,
-- not proof of presence.
create or replace function public.location_context(
  lat double precision, lng double precision
) returns text
language sql stable
set search_path = ''
as $$
  select case
    when lat is null or lng is null then 'unknown'
    when s.office_lat is null or s.office_lng is null then 'remote'
    when public.distance_m(lat, lng, s.office_lat, s.office_lng)
         <= s.office_radius_m then 'office'
    else 'remote'
  end
  from public.app_settings s
  where s.id = 1
$$;

-- ----------------------------------------------------------------------------
-- 3. Attendance RPCs — the ONLY write path for attendance_sessions
-- ----------------------------------------------------------------------------

create or replace function public.check_in(
  lat double precision default null,
  lng double precision default null,
  accuracy_m numeric default null
) returns public.attendance_sessions
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  emp public.employees%rowtype;
  ctx text;
  session public.attendance_sessions%rowtype;
begin
  -- Reject junk coordinates outright.
  if (lat is null) <> (lng is null)
     or lat not between -90 and 90
     or lng not between -180 and 180
     or accuracy_m < 0 then
    lat := null; lng := null; accuracy_m := null;
  end if;

  select * into emp from public.employees
  where email = public.jwt_email() and active;
  if not found then
    raise exception 'This email isn''t registered — contact your admin.'
      using errcode = 'P0001';
  end if;

  ctx := public.location_context(lat, lng);

  if emp.office_only and ctx <> 'office' then
    if ctx = 'unknown' then
      raise exception 'Your account requires checking in at the office, but we couldn''t read your location. Please enable location access and try again.'
        using errcode = 'P0001';
    else
      raise exception 'Your account requires checking in at the office. You appear to be outside the office area.'
        using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.attendance_sessions
      (employee_id, check_in_at, in_lat, in_lng, in_accuracy_m, in_context)
    values
      (emp.id, now(), lat, lng, accuracy_m, ctx)
    returning * into session;
  exception when unique_violation then
    raise exception 'You''re already checked in — check out first.'
      using errcode = 'P0001';
  end;

  return session;
end;
$$;

create or replace function public.check_out(
  lat double precision default null,
  lng double precision default null,
  accuracy_m numeric default null
) returns public.attendance_sessions
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  emp_id uuid;
  session public.attendance_sessions%rowtype;
begin
  if (lat is null) <> (lng is null)
     or lat not between -90 and 90
     or lng not between -180 and 180
     or accuracy_m < 0 then
    lat := null; lng := null; accuracy_m := null;
  end if;

  emp_id := public.me();
  if emp_id is null then
    raise exception 'This email isn''t registered — contact your admin.'
      using errcode = 'P0001';
  end if;

  update public.attendance_sessions
  set check_out_at   = now(),
      out_lat        = lat,
      out_lng        = lng,
      out_accuracy_m = accuracy_m,
      out_context    = public.location_context(lat, lng)
  where employee_id = emp_id and check_out_at is null
  returning * into session;

  if not found then
    raise exception 'You''re not checked in right now.'
      using errcode = 'P0001';
  end if;

  return session;
end;
$$;

-- Admin-only: close a forgotten session (at the server's current time) or
-- correct a checkout time. A note is mandatory and the row stays visibly
-- flagged via admin_note in both UIs.
-- out_at may be supplied by the ADMIN only, and is bounded:
-- check_in_at <= out_at <= now(). Employees still cannot supply timestamps.
create or replace function public.admin_close_session(
  session_id uuid,
  note text,
  out_at timestamptz default null
) returns public.attendance_sessions
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  effective_out timestamptz;
  session public.attendance_sessions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = 'P0001';
  end if;
  if note is null or length(trim(note)) = 0 then
    raise exception 'A note explaining the correction is required.'
      using errcode = 'P0001';
  end if;

  select * into session from public.attendance_sessions where id = session_id;
  if not found then
    raise exception 'Session not found.' using errcode = 'P0001';
  end if;

  effective_out := coalesce(out_at, now());
  if effective_out > now() then
    raise exception 'Checkout time cannot be in the future.'
      using errcode = 'P0001';
  end if;
  if effective_out < session.check_in_at then
    raise exception 'Checkout time cannot be before the check-in time.'
      using errcode = 'P0001';
  end if;

  update public.attendance_sessions
  set check_out_at = effective_out,
      admin_note   = trim(note)
  where id = session_id
  returning * into session;

  return session;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Tasks trigger — column-level rules + derived completed_at
-- ----------------------------------------------------------------------------
-- One combined BEFORE trigger so ordering can't be gamed:
--   1. Non-admins may update ONLY tasks currently assigned to them:
--        - assigned to you AND created by you (a personal task):
--          title/description/due_date/priority/status may change
--        - assigned to you by someone else: ONLY status may change
--        - assigned to someone else (even if you created it — e.g. the admin
--          reassigned your personal task): no edits at all
--        - assigned_to / created_by / created_at / id are always immutable
--   2. created_at and completed_at are server-derived, never client-supplied.

create or replace function public.tasks_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := public.me();
  admin boolean := public.is_admin();
begin
  if tg_op = 'UPDATE' and not admin then
    if new.assigned_to is distinct from old.assigned_to
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.id is distinct from old.id then
      raise exception 'You can''t reassign this task.' using errcode = 'P0001';
    end if;

    -- Only the current assignee may touch a task at all.
    if old.assigned_to is distinct from caller then
      raise exception 'Only the task''s current assignee can update it.'
        using errcode = 'P0001';
    end if;

    -- Task assigned by someone else (i.e. by the admin): status only.
    if old.created_by is distinct from caller then
      if new.title is distinct from old.title
         or new.description is distinct from old.description
         or new.due_date is distinct from old.due_date
         or new.priority is distinct from old.priority then
        raise exception 'Only the status of an assigned task can be changed.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- created_at / completed_at are server-derived, never client-supplied.
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.completed_at := case when new.status = 'done' then now() end;
  else
    new.completed_at := case
      when new.status = 'done' and old.status = 'done' then old.completed_at
      when new.status = 'done' then now()
      else null
    end;
  end if;

  return new;
end;
$$;

create trigger tasks_guard
  before insert or update on public.tasks
  for each row execute function public.tasks_guard();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.employees enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.app_settings enable row level security;
alter table public.tasks enable row level security;

-- employees: you can see your own row (even if inactive — the app uses it to
-- show the "not registered / deactivated" screen); admin sees and manages all.
create policy employees_select on public.employees
  for select to authenticated
  using (email = public.jwt_email() or public.is_admin());

create policy employees_insert_admin on public.employees
  for insert to authenticated
  with check (public.is_admin() and email = lower(email));

create policy employees_update_admin on public.employees
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and email = lower(email));

-- No DELETE policy: employees are deactivated, never deleted (history FK).

-- attendance_sessions: reads are row-scoped; writes ONLY via the RPCs above.
create policy sessions_select on public.attendance_sessions
  for select to authenticated
  using (employee_id = public.me() or public.is_admin());

-- No insert/update/delete policies — and privileges are revoked below.

-- app_settings: readable by active allowlisted employees only (me() is null
-- for strangers and deactivated accounts — they must not see office coords).
create policy settings_select on public.app_settings
  for select to authenticated
  using (public.me() is not null);

create policy settings_update_admin on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- tasks
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    assigned_to = public.me()
    or created_by = public.me()
    or public.is_admin()
  );

-- Everyone writes created_by = self; only admin may assign to someone else.
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    created_by = public.me()
    and public.me() is not null
    and (assigned_to = public.me() or public.is_admin())
  );

-- Updates require being the CURRENT assignee (or admin). A creator whose
-- task was reassigned by the admin keeps read access but loses edit rights;
-- the tasks_guard trigger enforces the same rule as a second layer.
create policy tasks_update on public.tasks
  for update to authenticated
  using (assigned_to = public.me() or public.is_admin())
  with check (assigned_to = public.me() or public.is_admin());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    public.is_admin()
    or (created_by = public.me() and assigned_to = public.me())
  );

-- ----------------------------------------------------------------------------
-- 6. Privileges — belt and suspenders on top of RLS
-- ----------------------------------------------------------------------------

-- anon (logged-out visitors) gets nothing at all.
revoke all on public.employees, public.attendance_sessions,
              public.app_settings, public.tasks from anon;

-- Attendance history is immutable to employees: no direct writes, ever.
revoke insert, update, delete on public.attendance_sessions from authenticated;

-- app_settings rows are seeded once; nobody inserts or deletes via the API.
revoke insert, delete on public.app_settings from authenticated;

-- employees: block deletes at the privilege level too.
revoke delete on public.employees from authenticated;

-- Functions: callable by signed-in users only.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.jwt_email(), public.me(), public.is_admin(),
  public.distance_m(double precision, double precision, double precision, double precision),
  public.location_context(double precision, double precision),
  public.check_in(double precision, double precision, numeric),
  public.check_out(double precision, double precision, numeric),
  public.admin_close_session(uuid, text, timestamptz)
to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Seed data
-- ----------------------------------------------------------------------------

insert into public.app_settings (id, office_lat, office_lng, office_radius_m, display_tz)
values (1, null, null, 150, 'Asia/Dubai')
on conflict (id) do nothing;

insert into public.employees (email, full_name, is_admin, active) values
  ('rudy@wildcamel.tv',    'Rudy',    true,  true),
  ('rakesh@wildcamel.tv',  'Rakesh',  false, true),
  ('jamali@wildcamel.tv',  'Jamali',  false, true),
  ('marilyn@wildcamel.tv', 'Marilyn', false, true),
  ('malak@wildcamel.tv',   'Malak',   false, true),
  ('emmad@wildcamel.tv',   'Emmad',   false, true)
on conflict (email) do nothing;
