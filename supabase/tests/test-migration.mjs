// Behavioral test of supabase/migrations/0001_init.sql against real Postgres
// semantics (PGlite). Emulates the Supabase environment: anon/authenticated
// roles, auth.jwt() reading request.jwt.claims, and Supabase's default
// privilege grants — then runs the QA checklist attacks.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const MIGRATION = readFileSync(
  new URL('../migrations/0001_init.sql', import.meta.url),
  'utf8',
)

const db = new PGlite()
let pass = 0
let fail = 0
const failures = []

async function raw(sql) {
  return db.exec(sql)
}

// Run a statement as a given identity. Returns {ok, rows, error}.
async function as(email, sql, params = []) {
  try {
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email }).replace(/'/g, "''")}', false);`,
    )
    const res = params.length
      ? await db.query(sql, params)
      : (await db.exec(sql)).at(-1)
    return { ok: true, rows: res?.rows ?? [] }
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) }
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }
}

async function asAnon(sql) {
  try {
    await db.exec(`set role anon;`)
    const res = (await db.exec(sql)).at(-1)
    return { ok: true, rows: res?.rows ?? [] }
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) }
  } finally {
    await db.exec(`reset role;`)
  }
}

function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  FAIL  ${name}  ${detail}`)
  }
}

// --- Supabase environment shim -------------------------------------------
await raw(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create or replace function auth.jwt() returns jsonb
    language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)

// --- 1. The migration itself must run clean ------------------------------
console.log('\n[1] Migration executes')
try {
  await raw(MIGRATION)
  check('migration runs without error', true)
} catch (e) {
  check('migration runs without error', false, String(e?.message ?? e))
  console.log('\nAborting — migration failed to apply.')
  process.exit(1)
}

const seeded = await raw(`select email, is_admin from public.employees order by email;`)
check(
  'six employees seeded, rudy sole admin',
  seeded.at(-1).rows.length === 6 &&
    seeded.at(-1).rows.filter((r) => r.is_admin).map((r) => r.email).join() ===
      'rudy@wildcamel.tv',
)

// --- 2. Anon gets nothing --------------------------------------------------
console.log('\n[2] Anon access')
for (const t of ['employees', 'attendance_sessions', 'app_settings', 'tasks']) {
  const r = await asAnon(`select * from public.${t};`)
  check(`anon cannot select ${t}`, !r.ok, r.ok ? 'rows visible!' : '')
}
{
  const r = await asAnon(`select public.check_in(null, null, null);`)
  check('anon cannot call check_in', !r.ok)
}

// --- 3. Unregistered / allowlist ------------------------------------------
console.log('\n[3] Unregistered email')
{
  const r = await as('stranger@evil.com', `select * from public.employees;`)
  check('stranger sees no employees rows', r.ok && r.rows.length === 0, JSON.stringify(r))
  const s = await as('stranger@evil.com', `select * from public.app_settings;`)
  check('stranger cannot read app_settings (office coords)', s.ok && s.rows.length === 0, JSON.stringify(s))
  const c = await as('stranger@evil.com', `select public.check_in(null, null, null);`)
  check('stranger check_in raises not-registered', !c.ok && /isn't registered/.test(c.error), c.error)
  const t = await as('stranger@evil.com', `select * from public.tasks;`)
  check('stranger sees no tasks', t.ok && t.rows.length === 0)
}

// --- 4. Check-in / check-out anti-tamper -----------------------------------
console.log('\n[4] Attendance anti-tamper')
{
  // Admin configures the office first (also tests settings update policy).
  const set = await as(
    'rudy@wildcamel.tv',
    `update public.app_settings set office_lat = 25.2048, office_lng = 55.2708, office_radius_m = 150 where id = 1 returning office_lat;`,
  )
  check('admin can update app_settings', set.ok && set.rows.length === 1, JSON.stringify(set))

  const eset = await as(
    'emmad@wildcamel.tv',
    `update public.app_settings set office_radius_m = 99999 where id = 1 returning id;`,
  )
  check('employee cannot update app_settings', eset.ok && eset.rows.length === 0, JSON.stringify(eset))

  // Office check-in ~30m from the office point.
  const ci = await as('emmad@wildcamel.tv', `select (public.check_in(25.20505, 55.2708, 12)).in_context;`)
  check('check_in near office → office context', ci.ok && ci.rows[0]?.in_context === 'office', JSON.stringify(ci))

  const dbl = await as('emmad@wildcamel.tv', `select public.check_in(25.20505, 55.2708, 12);`)
  check('double check-in blocked (friendly)', !dbl.ok && /already checked in/.test(dbl.error), dbl.error)

  // Direct writes must be impossible for employees.
  const ins = await as(
    'emmad@wildcamel.tv',
    `insert into public.attendance_sessions (employee_id, check_in_at) values ((select public.me()), '2020-01-01') returning id;`,
  )
  check('direct INSERT on sessions denied', !ins.ok && /permission denied/.test(ins.error), ins.error)

  const upd = await as(
    'emmad@wildcamel.tv',
    `update public.attendance_sessions set check_in_at = '2020-01-01' returning id;`,
  )
  check('direct UPDATE on sessions denied', !upd.ok && /permission denied/.test(upd.error), upd.error)

  const del = await as('emmad@wildcamel.tv', `delete from public.attendance_sessions returning id;`)
  check('direct DELETE on sessions denied', !del.ok && /permission denied/.test(del.error), del.error)

  const co = await as('emmad@wildcamel.tv', `select (public.check_out(25.3, 55.5, 8)).out_context;`)
  check('check_out far away → remote context', co.ok && co.rows[0]?.out_context === 'remote', JSON.stringify(co))

  const co2 = await as('emmad@wildcamel.tv', `select public.check_out(null, null, null);`)
  check('check_out with no open session refused', !co2.ok && /not checked in/.test(co2.error), co2.error)

  // Timestamps are server-clock: the session we just made must be "now".
  const when = await raw(
    `select abs(extract(epoch from (now() - check_in_at))) < 60 as fresh from public.attendance_sessions limit 1;`,
  )
  check('check_in_at is server now()', when.at(-1).rows[0]?.fresh === true)

  // office_only enforcement
  await raw(`update public.employees set office_only = true where email = 'jamali@wildcamel.tv';`)
  const j1 = await as('jamali@wildcamel.tv', `select public.check_in(null, null, null);`)
  check('office_only + no location → friendly refusal', !j1.ok && /enable location/.test(j1.error), j1.error)
  const j2 = await as('jamali@wildcamel.tv', `select public.check_in(24.0, 54.0, 10);`)
  check('office_only + outside radius → refusal', !j2.ok && /outside the office/.test(j2.error), j2.error)
  const j3 = await as('jamali@wildcamel.tv', `select (public.check_in(25.2048, 55.2708, 10)).in_context;`)
  check('office_only inside radius → checks in', j3.ok && j3.rows[0]?.in_context === 'office', JSON.stringify(j3))
}

// --- 5. RLS row isolation ---------------------------------------------------
console.log('\n[5] Row isolation')
{
  const mine = await as('emmad@wildcamel.tv', `select distinct employee_id from public.attendance_sessions;`)
  const meId = await as('emmad@wildcamel.tv', `select public.me() as id;`)
  check(
    'employee sees only own sessions',
    mine.ok && mine.rows.length === 1 && mine.rows[0].employee_id === meId.rows[0].id,
    JSON.stringify(mine),
  )
  const emp = await as('emmad@wildcamel.tv', `select email from public.employees;`)
  check('employee sees only own employees row', emp.ok && emp.rows.length === 1 && emp.rows[0].email === 'emmad@wildcamel.tv')
  const all = await as('rudy@wildcamel.tv', `select count(*)::int as n from public.attendance_sessions;`)
  check('admin sees all sessions', all.ok && all.rows[0].n === 2, JSON.stringify(all))
  const allEmp = await as('rudy@wildcamel.tv', `select count(*)::int as n from public.employees;`)
  check('admin sees all employees', allEmp.ok && allEmp.rows[0].n === 6)
}

// --- 6. Admin session corrections -------------------------------------------
console.log('\n[6] Admin corrections')
{
  const sid = (await raw(`select id, check_in_at from public.attendance_sessions where check_out_at is null limit 1;`)).at(-1).rows[0]
  const noNote = await as('rudy@wildcamel.tv', `select public.admin_close_session('${sid.id}', '');`)
  check('correction without note refused', !noNote.ok && /note/.test(noNote.error), noNote.error)
  const future = await as('rudy@wildcamel.tv', `select public.admin_close_session('${sid.id}', 'x', now() + interval '1 day');`)
  check('future checkout refused', !future.ok && /future/.test(future.error), future.error)
  const before = await as('rudy@wildcamel.tv', `select public.admin_close_session('${sid.id}', 'x', '2000-01-01');`)
  check('checkout before check-in refused', !before.ok && /before the check-in/.test(before.error), before.error)
  const emp = await as('emmad@wildcamel.tv', `select public.admin_close_session('${sid.id}', 'sneaky');`)
  check('employee cannot call admin_close_session', !emp.ok && /Admins only/.test(emp.error), emp.error)
  const good = await as('rudy@wildcamel.tv', `select (public.admin_close_session('${sid.id}', 'Forgot to check out')).admin_note;`)
  check('admin closes with note, note stored', good.ok && good.rows[0]?.admin_note === 'Forgot to check out', JSON.stringify(good))
}

// --- 7. Tasks permissions ----------------------------------------------------
console.log('\n[7] Tasks')
{
  const ids = {}
  for (const r of (await raw(`select id, email from public.employees;`)).at(-1).rows) ids[r.email] = r.id

  // personal task; attempt to backdate created_at and pre-set completed_at
  const t1 = await as(
    'emmad@wildcamel.tv',
    `insert into public.tasks (title, assigned_to, created_by, created_at, completed_at, status)
     values ('My personal task', '${ids['emmad@wildcamel.tv']}', '${ids['emmad@wildcamel.tv']}', '2000-01-01', '2000-01-01', 'todo')
     returning id, created_at > now() - interval '1 minute' as fresh, completed_at;`,
  )
  check('personal task insert ok; created_at pinned to now(); completed_at null', t1.ok && t1.rows[0]?.fresh === true && t1.rows[0]?.completed_at === null, JSON.stringify(t1))
  const personal = t1.rows[0]?.id

  const t2 = await as(
    'emmad@wildcamel.tv',
    `insert into public.tasks (title, assigned_to, created_by) values ('for someone else', '${ids['malak@wildcamel.tv']}', '${ids['emmad@wildcamel.tv']}') returning id;`,
  )
  check('employee cannot assign a task to someone else', !t2.ok, JSON.stringify(t2.rows ?? t2.error))

  const t3 = await as(
    'emmad@wildcamel.tv',
    `insert into public.tasks (title, assigned_to, created_by) values ('forged creator', '${ids['emmad@wildcamel.tv']}', '${ids['rudy@wildcamel.tv']}') returning id;`,
  )
  check('employee cannot forge created_by', !t3.ok)

  // admin assigns a task to emmad
  const t4 = await as(
    'rudy@wildcamel.tv',
    `insert into public.tasks (title, assigned_to, created_by, due_date, priority)
     values ('Client cut — Al Noor', '${ids['emmad@wildcamel.tv']}', '${ids['rudy@wildcamel.tv']}', current_date + 3, 'high') returning id;`,
  )
  check('admin can assign to others', t4.ok && t4.rows.length === 1, JSON.stringify(t4))
  const assigned = t4.rows[0]?.id

  const vis = await as('malak@wildcamel.tv', `select id from public.tasks;`)
  check("others can't see emmad's tasks", vis.ok && vis.rows.length === 0, JSON.stringify(vis))

  const st = await as('emmad@wildcamel.tv', `update public.tasks set status = 'in_progress' where id = '${assigned}' returning status;`)
  check('assignee can change status of assigned task', st.ok && st.rows[0]?.status === 'in_progress', JSON.stringify(st))

  const ren = await as('emmad@wildcamel.tv', `update public.tasks set title = 'renamed' where id = '${assigned}' returning id;`)
  check('assignee cannot rename admin-assigned task', !ren.ok && /Only the status/.test(ren.error), ren.error ?? JSON.stringify(ren))

  const reas = await as('emmad@wildcamel.tv', `update public.tasks set assigned_to = '${ids['malak@wildcamel.tv']}' where id = '${assigned}' returning id;`)
  check('assignee cannot reassign admin-assigned task', !reas.ok && /reassign/.test(reas.error), reas.error ?? JSON.stringify(reas))

  const done = await as('emmad@wildcamel.tv', `update public.tasks set status = 'done' where id = '${assigned}' returning completed_at is not null as has_ts;`)
  check('status→done sets completed_at via trigger', done.ok && done.rows[0]?.has_ts === true, JSON.stringify(done))
  const reopen = await as('emmad@wildcamel.tv', `update public.tasks set status = 'todo' where id = '${assigned}' returning completed_at;`)
  check('reopen clears completed_at', reopen.ok && reopen.rows[0]?.completed_at === null, JSON.stringify(reopen))

  const delAssigned = await as('emmad@wildcamel.tv', `delete from public.tasks where id = '${assigned}' returning id;`)
  check('assignee cannot delete admin-assigned task', delAssigned.ok && delAssigned.rows.length === 0, JSON.stringify(delAssigned))

  // The reassignment hole found by the review — verify it is closed.
  await as('rudy@wildcamel.tv', `update public.tasks set assigned_to = '${ids['malak@wildcamel.tv']}' where id = '${personal}';`)
  const sneak = await as('emmad@wildcamel.tv', `update public.tasks set title = 'rewritten after reassign' where id = '${personal}' returning id;`)
  check('creator cannot edit own task after admin reassigned it', !sneak.ok || sneak.rows.length === 0, JSON.stringify(sneak.rows ?? sneak.error))
  const sneakStatus = await as('emmad@wildcamel.tv', `update public.tasks set status = 'done' where id = '${personal}' returning id;`)
  check('creator cannot flip status after reassignment', !sneakStatus.ok || sneakStatus.rows.length === 0, JSON.stringify(sneakStatus.rows ?? sneakStatus.error))
  const newAssigneeStatus = await as('malak@wildcamel.tv', `update public.tasks set status = 'in_progress' where id = '${personal}' returning status;`)
  check('new assignee can update status', newAssigneeStatus.ok && newAssigneeStatus.rows[0]?.status === 'in_progress', JSON.stringify(newAssigneeStatus))

  const delPersonal = await as('emmad@wildcamel.tv', `insert into public.tasks (title, assigned_to, created_by) values ('temp', '${ids['emmad@wildcamel.tv']}', '${ids['emmad@wildcamel.tv']}') returning id;`)
  const delOk = await as('emmad@wildcamel.tv', `delete from public.tasks where id = '${delPersonal.rows[0].id}' returning id;`)
  check('employee can delete own personal task', delOk.ok && delOk.rows.length === 1, JSON.stringify(delOk))
}

// --- 8. Deactivation ---------------------------------------------------------
console.log('\n[8] Deactivation')
{
  await as('rudy@wildcamel.tv', `update public.employees set active = false where email = 'malak@wildcamel.tv';`)
  const r = await as('malak@wildcamel.tv', `select public.check_in(null,null,null);`)
  check('deactivated employee cannot check in', !r.ok && /isn't registered/.test(r.error), r.error)
  const own = await as('malak@wildcamel.tv', `select active from public.employees;`)
  check('deactivated employee still sees own row (for the blocked screen)', own.ok && own.rows.length === 1 && own.rows[0].active === false)
  const tasks = await as('malak@wildcamel.tv', `select id from public.tasks;`)
  check('deactivated employee sees no tasks', tasks.ok && tasks.rows.length === 0, JSON.stringify(tasks))
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`)
if (failures.length) {
  console.log('Failures:', failures.join(' | '))
  process.exit(1)
}
