-- ============================================================================
-- Wild Camel Attendance — push notifications
-- ============================================================================
-- Run this AFTER 0001_init.sql. Adds the push subscription store used by the
-- notify-task-assigned Edge Function.
--
-- RLS: each employee may insert/read/delete only their OWN subscriptions.
-- Nobody can read anyone else's. The Edge Function reaches this table with the
-- service_role key (which bypasses RLS) to look up an assignee's devices.
-- ============================================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_by_employee
  on public.push_subscriptions (employee_id);

alter table public.push_subscriptions enable row level security;

-- Insert only your own subscription (employee_id must be your own id).
create policy push_insert_self on public.push_subscriptions
  for insert to authenticated
  with check (employee_id = public.me() and public.me() is not null);

-- Read only your own (used to check whether this device is already subscribed).
create policy push_select_self on public.push_subscriptions
  for select to authenticated
  using (employee_id = public.me());

-- Delete only your own (the in-app "turn off" switch).
create policy push_delete_self on public.push_subscriptions
  for delete to authenticated
  using (employee_id = public.me());

-- No UPDATE policy: a device either has a subscription row or it doesn't.

-- anon gets nothing.
revoke all on public.push_subscriptions from anon;
