# Wild Camel — Attendance

A check-in / check-out attendance tracker with a task system, built for the Wild
Camel team. Employees clock in and out from their phones (office or remote); Rudy
gets an admin dashboard. Static frontend (Vite + React) on **GitHub Pages**,
backed by **Supabase** (Postgres + Auth + Row Level Security). No custom server —
every security rule lives in the database.

- **Employees** sign in with a passwordless email magic link.
- **Admin (Rudy)** signs in with email + password.
- All anti-tamper logic (server clock, no backdating, RLS, immutable history) is
  enforced in Postgres, because a static site can't be trusted with it.

---

## Table of contents

1. [How it's put together](#how-its-put-together)
2. [Run it locally (optional)](#run-it-locally-optional)
3. [Full setup — do these in order](#full-setup--do-these-in-order)
   - [1. Run the database migration](#1-run-the-database-migration)
   - [2. Configure Auth URLs](#2-configure-auth-urls)
   - [3. Create Rudy's admin login](#3-create-rudys-admin-login)
   - [4. Custom email (SMTP) — required](#4-custom-email-smtp--required)
   - [5. Push to GitHub + add secrets + enable Pages](#5-push-to-github--add-secrets--enable-pages)
   - [6. First login test](#6-first-login-test)
   - [7. Set the office location](#7-set-the-office-location)
4. [Push notifications](#push-notifications) — see [`docs/PUSH_NOTIFICATIONS.md`](docs/PUSH_NOTIFICATIONS.md)
5. [QA checklist](#qa-checklist)
6. [Go-live checklist](#go-live-checklist)
7. [Handover note for Rudy](#handover-note-for-rudy)
8. [Good to know](#good-to-know)

---

## How it's put together

| Layer | What | Where |
|---|---|---|
| Frontend | Vite + React + TypeScript + Tailwind v4, HashRouter | `src/`, built to `dist/` |
| Hosting | GitHub Pages via GitHub Actions | `.github/workflows/deploy.yml` |
| Backend | Supabase Postgres, Auth, RLS, RPC functions | `supabase/migrations/0001_init.sql` |
| Secrets | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env` locally, repo secrets in CI |

The Supabase URL and **anon** key are shipped in the frontend bundle. That's safe
**only because** Row Level Security is on for every table and all attendance
writes go through `SECURITY DEFINER` functions. The `service_role` / secret key
must never appear in this project.

---

## Run it locally (optional)

You don't need this to go live, but it's handy for trying things.

```bash
npm install
cp .env.example .env      # then paste your two Supabase values into .env
npm run dev               # open the printed http://localhost:5173
```

Other commands:

```bash
npm run build     # production build into dist/
npm run test:db   # runs the database migration in an in-memory Postgres and
                  # checks all the anti-tamper rules (no Supabase account needed)
```

Your `.env` values (already filled in for this project):

```
VITE_SUPABASE_URL=https://stqadzsxjddhznljjcac.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi… (the long anon key)
```

> `.env` is gitignored — it never gets committed.

---

## Full setup — do these in order

Everything below happens in a browser (Supabase dashboard, GitHub). Each step is
click-by-click. Do them top to bottom.

### 1. Run the database migration

This creates the tables, security rules, functions, and seeds the six employees.

1. Go to <https://supabase.com/dashboard> → open **WildCamelHyperMedia's Project**.
2. Left sidebar → **SQL Editor**.
3. Click **+ New query**.
4. Open the file `supabase/migrations/0001_init.sql` from this project, select
   **all** of it, copy, and paste into the editor.
5. Click **Run** (bottom right, or ⌘/Ctrl + Enter).
6. You should see **“Success. No rows returned.”**

**Verify it worked** — paste this into a new query and Run:

```sql
select tablename,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
order by tablename;
```

You should get four rows — `app_settings`, `attendance_sessions`, `employees`,
`tasks` — each with one or more policies. Then check the seed:

```sql
select email, is_admin, active from public.employees order by email;
```

Six rows, with `rudy@wildcamel.tv` as the only `is_admin = true`.

> Re-running the whole migration is safe — it uses `create table` (which will
> error harmlessly if the tables already exist) and the seed uses
> `on conflict do nothing`. If you need a clean slate, drop the tables first.

### 2. Configure Auth URLs

So magic links and admin logins redirect back to the live app.

1. Supabase dashboard → **Authentication** → **URL Configuration**.
2. **Site URL**: set to your GitHub Pages address. It will look like
   `https://<your-github-username>.github.io/<repo-name>/`
   (you'll create the repo in step 5 — you can come back and set this after, but
   don't forget). If you don't know it yet, use a placeholder and fix it in step 5.
3. Under **Redirect URLs**, click **Add URL** and add the **same** address
   (with the trailing slash). Add `http://localhost:5173/` too if you want magic
   links to work in local dev.
4. **Save**.
5. While you're in **Authentication → Sign In / Providers**: make sure **Email**
   is **enabled** and **Confirm email** is **ON** (magic links rely on it). Leave
   **“Allow new users to sign up” ON.** This is deliberate: an employee's auth
   account is created the first time they click a magic link, and access is gated
   by the **employees allowlist enforced in the database (RLS)** — anyone can
   authenticate, but a non-allowlisted email lands on the “not registered” screen
   and can read nothing. (Turning signups off would block every employee's first
   login.)

### 3. Create Rudy's admin login

The migration seeds Rudy's *employee row* (with `is_admin = true`), but his actual
*auth account* (with a password) is created here.

1. Supabase dashboard → **Authentication** → **Users** → **Add user** → **Create
   new user**.
2. **Email**: `rudy@wildcamel.tv`
3. **Password**: the admin password from your password manager.
4. Tick **Auto Confirm User** (so he can log in immediately).
5. **Create user**.

> Lost the password later? Same screen: click Rudy's row → **Reset password** (or
> delete and re-create the user). It takes a few seconds — his data is untouched.

### 4. Custom email (SMTP) — required

**This is not optional.** Supabase's built-in email only delivers to members of
your Supabase organization and is throttled to ~2 emails/hour — so magic links to
the team would silently never arrive. We route auth emails through **Resend**
(free tier) instead.

**a. Create a Resend account**

1. Go to <https://resend.com> → **Sign up** (free).

**b. Verify the wildcamel.tv sending domain**

> `wildcamel.tv` DNS is hosted at **GoDaddy** (nameservers `ns*.domaincontrol.com`),
> and email runs through Microsoft 365 + Proofpoint. Resend places its sending
> records on a `send.` subdomain, so the steps below **do not touch your existing
> email** — never edit the root `@` MX or root SPF TXT.

1. Resend dashboard → **Domains** → **Add Domain** → enter `wildcamel.tv` → default
   region → **Add**. (Verifying the root gives a clean `no-reply@wildcamel.tv`
   sender; Resend still isolates its operational records on the `send` subdomain.)
2. Resend shows ~3 **DNS records**: an **MX** and **SPF `TXT`** on the `send` host,
   and a **DKIM `TXT`** at `resend._domainkey`. Copy the exact **Type / Name /
   Value** from that screen (the DKIM key is unique to your domain).
3. In **GoDaddy** → **Domain Portfolio → wildcamel.tv → DNS → Add New Record**,
   add each one. **GoDaddy auto-appends `.wildcamel.tv`**, so type only the short
   label (e.g. `send`, `resend._domainkey`) — never the full name, no trailing dot.
4. Back in Resend → **Verify**. Propagation is usually minutes (up to a few hours).

**c. Get SMTP credentials from Resend**

1. Resend dashboard → **API Keys** → **Create API Key** (permission: Sending
   access) → copy the key (starts with `re_…`) — **shown only once.** SMTP settings:
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (implicit TLS); use `587` if your network blocks 465
   - **Username**: the literal word `resend` (**not** your email — the #1 mistake)
   - **Password**: your Resend API key

**d. Plug them into Supabase**

1. Supabase dashboard → **Authentication → Emails → SMTP**
   (`/dashboard/project/<ref>/auth/smtp`).
2. Toggle **Enable Custom SMTP** on.
3. Fill in: **Sender email** `no-reply@wildcamel.tv` (must be on the verified
   domain) · **Sender name** `Wild Camel` · **Host** `smtp.resend.com` · **Port**
   `465` · **Username** `resend` · **Password** your API key → **Save**.
4. (Optional shortcut) Supabase's native **Resend integration** (Integrations tab)
   can auto-fill these fields via a connect flow instead of pasting the key.
5. After enabling custom SMTP, the auth-email limit defaults to **30/hour** — raise
   it under **Authentication → Rate Limits** if you expect bursts (stay under
   Resend's 100/day free cap). Then send yourself a magic link to confirm delivery.

### 5. Push to GitHub + add secrets + enable Pages

**a. Create the repo and push**

1. On <https://github.com> → **New repository**. Name it (e.g. `wildcamel-attendance`).
   You can make it **Private** — GitHub Pages works on private repos for the deploy
   we use. Don't add a README/gitignore (this project already has them).
2. In a terminal, from this project folder:
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```

**b. Add the two repo secrets**

1. On GitHub → your repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**, twice:
   - Name `VITE_SUPABASE_URL`, value `https://stqadzsxjddhznljjcac.supabase.co`
   - Name `VITE_SUPABASE_ANON_KEY`, value the long anon key (same as your `.env`).

**c. Enable Pages (via Actions)**

1. Repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions**.
3. That's it — the workflow in `.github/workflows/deploy.yml` runs on every push
   to `main`. Watch it under the repo's **Actions** tab; the first run publishes
   the site and prints the live URL (also shown on the Pages settings screen).

**d. Point Supabase at the real URL**

Now that you know the Pages URL, go back to
[step 2](#2-configure-auth-urls) and make sure **Site URL** and **Redirect URLs**
exactly match it (including the trailing slash). Magic-link logins won't redirect
correctly until they do.

### 6. First login test

1. On your **phone**, open the Pages URL.
2. Enter `emmad@wildcamel.tv` → **Send magic link**.
3. Open the email, tap the link — it should open the app, signed in.
4. Tap **Check In** (allow location when asked), watch the timer run, then
   press-and-hold **Check Out**.
5. Open **History** — the session should be there with an Office/Remote badge.
6. Test admin: open the app, tap **Admin sign in**, log in as
   `rudy@wildcamel.tv` — you should land on the Live board and see the check-in.

> Tip: **Add to Home Screen** from the browser share menu so it opens like a
> native app (and so push notifications can work later on iPhone).

### 7. Set the office location

So check-ins get labelled Office vs Remote correctly.

1. Sign in as Rudy → **Settings**.
2. Either type the office latitude/longitude, or (from a device **at** the office)
   click **Use my current location**.
3. Set the **radius** (meters) — 150 m is a sensible default.
4. Confirm the **display timezone** (Asia/Dubai).
5. **Save settings.**

---

## Push notifications

Task-assignment push notifications (Web Push, entirely free-tier) are a separate,
last phase. Full instructions — generating VAPID keys, deploying the Edge
Function, creating the Database Webhook — live in
[`docs/PUSH_NOTIFICATIONS.md`](docs/PUSH_NOTIFICATIONS.md).

---

## QA checklist

Verify the anti-tamper and permission rules. Most are covered automatically by
`npm run test:db` (which runs the real migration against an in-memory Postgres);
the ones marked 🖐 are worth checking by hand in the live app.

**Automated (`npm run test:db` — 51 checks):**

- [ ] Can't check in twice — a second check-in is refused with a friendly message.
- [ ] Can't check out with no open session — refused cleanly.
- [ ] `check_in_at` / `check_out_at` come from the server clock (no client time accepted).
- [ ] Employees can't `INSERT`/`UPDATE`/`DELETE` `attendance_sessions` directly with the anon key.
- [ ] An employee can only read their own sessions and their own employee row.
- [ ] `app_settings` (office coords) is not readable by an unregistered / deactivated user.
- [ ] An unregistered email can read/write nothing.
- [ ] Employees can't see each other's tasks.
- [ ] An employee can't rename, reprioritize, or reassign a task Rudy assigned them (status only).
- [ ] After Rudy reassigns a task, the original creator loses edit rights.
- [ ] `office_only` employees can't check in without a valid office location.
- [ ] Admin session corrections require a note and can't set a future / pre-check-in time.

**By hand in the live app 🖐:**

- [ ] Unregistered email (e.g. a personal Gmail) → sees the “not registered” screen, nothing else.
- [ ] Magic link only works for allowlisted emails.
- [ ] Deactivating an employee blocks their next check-in.
- [ ] CSV export downloads the current filtered view.
- [ ] An admin-adjusted session shows the “edited by admin” flag in both the employee History and the admin Records.
- [ ] Times display in the configured timezone (Asia/Dubai).

## Go-live checklist

- [ ] Migration run; verification queries look right (4 tables, 6 employees, Rudy admin).
- [ ] Auth: Email provider enabled, Confirm email on, "Allow new users to sign
      up" ON (allowlist is RLS-enforced; signups-off would block first logins).
- [ ] Site URL + Redirect URLs match the live Pages URL exactly (trailing slash).
- [ ] Rudy's auth user created and can log in.
- [ ] Custom SMTP (Resend) configured; wildcamel.tv domain **Verified**; a test magic link arrives.
- [ ] Repo pushed; both repo secrets set; Pages source = GitHub Actions; deploy succeeded.
- [ ] First login test passed on a phone (check in, check out, history, admin board).
- [ ] Office location + radius + timezone set in admin Settings.
- [ ] RLS confirmed ON for all four tables (the migration does this; verify in
      Supabase → Table Editor — each table shows an “RLS enabled” shield).
- [ ] (Optional, later) Push notifications set up per `docs/PUSH_NOTIFICATIONS.md`.

## Handover note for Rudy

A short, plain-English guide for day-to-day use.

**Logging in.** Open the app, tap **Admin sign in**, enter your email and
password. (Everyone else uses **Send magic link** — no passwords.) Add the app to
your phone's Home Screen so it opens like a real app.

**Adding a team member.** Admin → **Employees** → type their `@wildcamel.tv` email
and name → **Add employee**. That's all it takes — they can now sign in with a
magic link. Tick **Office only** if they must clock in from the office.

**Removing someone.** Employees → find them → **Deactivate**. They immediately
lose access; their past records stay intact. You can **Reactivate** later.

**Assigning a task.** Admin → **Tasks** → **Assign task** → pick the person, add a
title / due date / priority → **Assign**. It appears on their Tasks tab (and, once
push is set up, pings their phone). Overdue tasks float to the top of your list.

**Fixing a forgotten checkout.** Admin → **Records** → find the session (open ones
are flagged “missing out”) → **Close** or **Adjust** → you must add a short note →
**Save**. The correction is visibly flagged in both your view and theirs.

**Exporting hours.** Admin → **Records** → set the employee + date filters →
**Export CSV** (opens in Excel / Google Sheets).

**Where the data lives.** Everything is in Supabase. If you ever need to reset an
employee's login or your own password, that's in the Supabase dashboard under
Authentication → Users.

## Good to know

- **Free Supabase projects pause after ~1 week of zero activity.** Daily check-ins
  keep it awake. After a long company break (holidays), the project may need a
  one-click **Restore** in the Supabase dashboard — your data is kept, it just
  needs waking up.
- **iPhones only receive push notifications once the app is added to the Home
  Screen** (iOS 16.4+). Android and desktop browsers work directly.
- **The anon key is safe in the frontend.** The `service_role` / secret key must
  never be put in this project, in the repo, or in the frontend.
- **Location is informational, not proof.** Browser geolocation can be spoofed and
  can't read Wi-Fi, so Office/Remote labels are a helpful signal, not evidence. A
  future upgrade (an Edge Function comparing the requester's IP to the office's
  static IP) is noted but out of scope for v1.
