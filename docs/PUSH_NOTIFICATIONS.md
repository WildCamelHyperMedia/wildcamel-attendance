# Push notifications — setup

Task-assignment push notifications, using standard **Web Push** on entirely free
tiers (no paid service, no third-party push provider). Do this **after** the core
app is live and tested (README steps 1–7).

**What you'll get:** when Rudy assigns a task to someone (or reassigns one to a
new person), that person's phone/desktop gets a "New task: …" notification.
Tapping it opens the app on the Tasks tab.

**How it works:**

```
Rudy assigns a task
      │  INSERT / UPDATE on public.tasks
      ▼
Database Webhook  ──POST──▶  Edge Function `notify-task-assigned`
                                   │ looks up the assignee's devices
                                   │ (push_subscriptions, service-role read)
                                   ▼
                            Web Push  ──▶  the employee's phone / browser
```

You'll do five things:

1. [Run the push table migration](#1-run-the-push-table-migration)
2. [Generate VAPID keys](#2-generate-vapid-keys)
3. [Deploy the Edge Function + set its secrets](#3-deploy-the-edge-function--set-its-secrets)
4. [Create the Database Webhook](#4-create-the-database-webhook)
5. [Add the public key to the frontend + redeploy](#5-add-the-public-key-to-the-frontend--redeploy)

Then [test it](#test-checklist).

---

## 1. Run the push table migration

1. Supabase dashboard → **SQL Editor** → **+ New query**.
2. Paste all of `supabase/migrations/0002_push.sql`, **Run**.
3. Expect **“Success. No rows returned.”** This creates `push_subscriptions`
   (each employee can only touch their own rows).

## 2. Generate VAPID keys

VAPID keys identify your app to the browsers' push services. Generate a pair
locally:

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep this output handy for the
next steps.

- The **public** key goes in the frontend (`VITE_VAPID_PUBLIC_KEY`) — safe to ship.
- The **private** key goes **only** into the Edge Function secrets — never in the
  repo, never in the frontend.

## 3. Deploy the Edge Function + set its secrets

The function lives at `supabase/functions/notify-task-assigned/index.ts`. Two ways
to deploy — pick whichever you're comfortable with.

### Option A — paste into the dashboard (no CLI)

1. Supabase dashboard → **Edge Functions** → **Create a function**.
2. Name it exactly `notify-task-assigned`.
3. Replace the starter code with the full contents of
   `supabase/functions/notify-task-assigned/index.ts`, and **Deploy**.
4. Set its secrets: **Edge Functions → notify-task-assigned → Secrets** (or
   **Project Settings → Edge Functions → Secrets**) and add:
   - `VAPID_PUBLIC_KEY` = the public key from step 2
   - `VAPID_PRIVATE_KEY` = the private key from step 2
   - `VAPID_SUBJECT` = `mailto:rudy@wildcamel.tv`
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically — you
   don't set those.)

### Option B — Supabase CLI

```bash
# one-time
npm install -g supabase
supabase login
supabase link --project-ref stqadzsxjddhznljjcac

# set secrets
supabase secrets set VAPID_PUBLIC_KEY="<public key>"
supabase secrets set VAPID_PRIVATE_KEY="<private key>"
supabase secrets set VAPID_SUBJECT="mailto:rudy@wildcamel.tv"

# deploy
supabase functions deploy notify-task-assigned
```

> The function verifies the webhook came from your database via the shared secret
> below — it does not need to be publicly callable by anyone else.

## 4. Create the Database Webhook

This calls the function whenever a task is created or reassigned.

1. Supabase dashboard → **Database** → **Webhooks** → **Create a new hook**
   (if this is the first time, you may be prompted to **Enable** webhooks — do so).
2. **Name**: `on-task-assigned`
3. **Table**: `tasks` (schema `public`)
4. **Events**: tick **Insert** and **Update**.
5. **Type**: **Supabase Edge Functions** → choose `notify-task-assigned`.
   (If only "HTTP Request" is offered, use the function URL
   `https://stqadzsxjddhznljjcac.supabase.co/functions/v1/notify-task-assigned`,
   method **POST**.)
6. **HTTP Headers**: add `Authorization` = `Bearer <your service_role key>`
   (Supabase → Project Settings → API → `service_role` key). This lets the
   webhook invoke the function. The service_role key stays server-side in the
   webhook config — it is never exposed to the frontend.
7. **Create**.

> The function itself only acts when the task wasn't self-created and the assignee
> changed, so employees adding personal to-dos won't trigger notifications, and
> editing a task's title won't re-notify.

## 5. Add the public key to the frontend + redeploy

1. Add the public key as a **repo secret** so the deployed build includes it:
   GitHub → repo → **Settings → Secrets and variables → Actions → New repository
   secret** → name `VITE_VAPID_PUBLIC_KEY`, value the public key.
2. Add the same to the CI build step. Edit `.github/workflows/deploy.yml`, in the
   **Build** step's `env:` block, add:
   ```yaml
           VITE_VAPID_PUBLIC_KEY: ${{ secrets.VITE_VAPID_PUBLIC_KEY }}
   ```
3. For local testing, also put it in your `.env`:
   ```
   VITE_VAPID_PUBLIC_KEY=<public key>
   ```
4. Commit and push — the deploy runs and the app now shows an **Enable
   notifications** control on the Tasks tab. (Until the key is present, the control
   stays hidden — nothing breaks.)

## Test checklist

- [ ] On an **Android phone or desktop Chrome/Firefox**, open the app as an
      employee → **Tasks** tab → **Enable** notifications → allow when prompted.
- [ ] On an **iPhone**: first **Add to Home Screen**, open it from there, then the
      Enable button appears (iOS only allows web push for installed web apps,
      16.4+). Before install, the app shows the "Add to Home Screen first" hint.
- [ ] From Rudy's account, **assign a task** to that employee.
- [ ] Within a few seconds, the employee's device shows **"New task: …"**.
- [ ] Tapping the notification opens the app on the **Tasks** tab.
- [ ] Turn notifications **off** with the same control — the subscription is removed.

### If a notification doesn't arrive

- Check **Edge Functions → notify-task-assigned → Logs** for errors (bad VAPID
  keys show up here).
- Check **Database → Webhooks → on-task-assigned → Logs** — a non-200 response
  means the webhook couldn't reach the function (usually the `Authorization`
  header).
- Confirm the employee actually enabled notifications on that device (a row exists
  in `push_subscriptions` for them).
- Expired devices are pruned automatically (the function deletes subscriptions
  that return 404/410).
