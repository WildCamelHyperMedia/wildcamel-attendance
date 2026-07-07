// Supabase Edge Function: notify-task-assigned
// -----------------------------------------------------------------------------
// Invoked by a Database Webhook on public.tasks:
//   - INSERT: always considered (a newly created/assigned task)
//   - UPDATE: only when assigned_to changed (task reassigned to someone new)
//
// If the task was NOT self-created (assigned_to !== created_by), it sends a Web
// Push ("New task: {title}") to every push subscription belonging to the
// assignee. Expired devices (404/410) are pruned.
//
// Secrets required (set with `supabase secrets set` or in the dashboard):
//   VAPID_PUBLIC_KEY   — the same public key shipped in the frontend
//   VAPID_PRIVATE_KEY  — private key; NEVER in the repo or frontend
//   VAPID_SUBJECT      — a mailto: or https: contact URI, e.g. mailto:rudy@wildcamel.tv
// Provided automatically by the platform:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// -----------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

interface TaskRow {
  id: string
  title: string
  assigned_to: string
  created_by: string
  status: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: TaskRow | null
  old_record: TaskRow | null
}

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@wildcamel.tv'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const task = payload.record
  if (!task || payload.table !== 'tasks') {
    return json({ skipped: 'not a task row' })
  }

  // Only notify on new assignments or reassignments to a different person.
  if (payload.type === 'UPDATE') {
    const prev = payload.old_record
    if (prev && prev.assigned_to === task.assigned_to) {
      return json({ skipped: 'assignee unchanged' })
    }
  } else if (payload.type !== 'INSERT') {
    return json({ skipped: `ignored event ${payload.type}` })
  }

  // Self-created personal tasks don't notify.
  if (task.assigned_to === task.created_by) {
    return json({ skipped: 'self-assigned' })
  }

  // Look up the assignee's devices (service role bypasses RLS).
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('employee_id', task.assigned_to)

  if (error) return json({ error: error.message }, 500)
  if (!subs || subs.length === 0) return json({ sent: 0, note: 'no devices' })

  const notification = JSON.stringify({
    title: 'New task',
    body: task.title,
    tag: `task-${task.id}`,
    url: './#/app/tasks',
  })

  let sent = 0
  const expiredIds: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          notification,
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 404/410 = the subscription is gone; prune it.
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(s.id)
        } else {
          console.error('push send failed', statusCode, (err as Error).message)
        }
      }
    }),
  )

  if (expiredIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return json({ sent, pruned: expiredIds.length })
})
