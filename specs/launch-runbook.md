# Launch runbook: production schema and deploy

Production Supabase `rtbkrngsdbptbjhfbcud` (Postgres 17.6), Vercel project for www.tethos.ca. Written 2026-09-26 by the launch-readiness fixes task; steps 2, 3 and 5 were rehearsed on `tethos-staging` (`specs/evidence/launch-fixes/`). Run it top to bottom in one window. Every production write is in steps 0 (plan), 2, 3 and 4.

## Never

- **Never `supabase db push`** (nor `migration up`, `db reset`, or linking the CLI to production and "syncing"). Production's ledger (`supabase_migrations.schema_migrations`) lists 10 versions; `001`–`028` and the 2026-09-26 security files were applied in the SQL editor. `db push` would try to replay all of them. Migrations go through the management API, one file at a time (ruling 5).
- No key, database password or invite code in a tracked file, commit message, PR or evidence file.
- Apply each file once, in order. `20260926200000_membership_launch`'s backfill is guarded anyway: it writes `data_backfills.membership_launch` in the same transaction and skips when the row exists, so a rerun never flips members marked since (it only re-creates its two functions). Never delete that row.

## 0. The day before

1. **Branch green.** On the launch commit: `cd web && npx tsc --noEmit && npx vitest run`, and `zsh specs/evidence/launch-fixes/sql-smoke.sh` (every section `ok`, no `ERROR`/`FAIL`). The smoke script's `GAME` list must name every migration after `20260926130000`; add any merged since.
2. **Supabase Pro.** Dashboard → Organization → Billing. If production is on Free, upgrade (David pre-approved it, roadmap "Direction"); if the dashboard wants a payment step only David can do, hand that one step to him. Then check `GET https://api.supabase.com/v1/projects/rtbkrngsdbptbjhfbcud` answers `"status": "ACTIVE_HEALTHY"` and `GET …/database/backups` lists a backup from the last 24 h.
3. **Local safety copy.** Homebrew's `pg_dump` 16 refuses a 17 server: `brew install postgresql@17`, then `/opt/homebrew/opt/postgresql@17/bin/pg_dump "<session pooler URI>" -Fc -f ~/tethos-prod-<date>.dump` (URI and password from the dashboard; the file stays outside the repo).
4. **Token.** `SUPABASE_ACCESS_TOKEN` from the Supabase CLI keychain entry: `security find-generic-password -s "Supabase CLI" -w`, strip `go-keyring-base64:`, base64-decode unless it starts with `sbp_`. Export it in the shell only.

## 1. Drift check (read-only)

1. Re-run the Phase 1 catalog dump against production with `"read_only": true` (method in `specs/evidence/phase1/schema-drift.md`) and compare with that file. Expected: nothing new since 2026-09-26. Anything new (a column, a policy, a function body): stop, reconcile it on staging with a new idempotent migration, and only then continue.
2. **The reconcile migration is not run first.** `20260926155000_schema_drift_reconcile` runs in filename order in step 2. Its `handle_new_user()` reads `member_email_whitelist` and `profiles.membership`, which `150700_identity` creates; run before it, every sign-up until then would lose its profile silently (the function's failure guard swallows the error). Production's drift doesn't block any earlier file: all 13 game drafts applied cleanly on prod-shaped staging without it.
3. Expected membership after launch (read-only, save the numbers):
   ```sql
   select count(*) filter (where m) as members, count(*) filter (where not m) as public, count(*) as total
     from (select p.tier <= 3
                  or exists (select 1 from applications a where a.user_id = p.id and a.status = 'accepted')
                  or exists (select 1 from auth.users u where u.id = p.id and upper(trim(u.raw_user_meta_data->>'invite_code')) = 'TETHOS-W26') as m
             from profiles p) x;
   ```
   2026-09-26: 43 members (T1, T2, 41 at T4: the 15 hires and the W26 sign-ups), 272 public, 315 total. W26 sign-ups count as members (ruling 2026-09-26: the winter-2026 onboarding code for accepted members); sign-ups with it after step 3 are public.

## 2. Migrations (management API, filename order, one transaction per file)

The files are every migration after `20260926130000_portal_rls_hardening` (production already has everything up to and including it), in `ls` order on the launch commit:

```zsh
ls web/supabase/migrations | awk '$0 > "20260926130000_zzz"'
```

As of 2026-09-26 on `game/launch-fixes`: `20260926150000_game_coins`, `150100_seasonal_seed`, `150200_progression`, `150300_homes`, `150400_collections`, `150500_study`, `150600_economy`, `150700_identity`, `150800_combat`, `150900_collections_server_only`, `151000_economy_sell_lock`, `151100_wallet_gem_types`, `151200_profiles_class_server_only`, `155000_schema_drift_reconcile`, `155100_letters_broadcast_unique`, `155200_event_attendance_rsvp_only`, `155300_invite_codes_private`, `155400_member_badges_signed_in_only`, `160000_crafting`, `170000_profiles_avatar_config`, `180000_ownership`, `190000_combat_content`, `200000_membership_launch`, `200100_event_rsvp_cancel` (24 files). Branches merged later add theirs; two files must never share a timestamp (the ledger keys on it).

Apply each file on its own, stopping at the first error:

```zsh
f=web/supabase/migrations/<file>.sql
body=$(jq -n --rawfile q $f '{query: ("begin;\n" + $q + "\ncommit;")}')
curl -sS -X POST https://api.supabase.com/v1/projects/rtbkrngsdbptbjhfbcud/database/query \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d "$body"
```

`[]` means applied. An error means that file rolled back on its own (earlier files stay applied): stop, fix forward on staging, resume at that file. Keep a local log of file → time → response.

What lands where:

- `20260926200000_membership_launch`: the membership backfill (staff, hires, whitelist and W26 sign-ups stay members; everyone else public at T5) runs **once**, guarded by `data_backfills`; public sign-ups get T5 from here on; `admin_set_membership` for the mark-member route.
- `20260926200100_event_rsvp_cancel`: members can cancel their own RSVP.
- The two admin routes (`POST /api/admin/members/:id/membership`, and `PATCH /api/admin/members/:id` for tier/active/alumni, which the members page now uses) are code: they arrive with the deploy in step 4. Until then the live members page's tier/active/alumni buttons keep doing nothing, as they have since #40.

Right **before `20260926200000_membership_launch`**, save the rollback snapshot locally (read-only, ids only):

```sql
select json_agg(json_build_object('id', id, 'membership', membership, 'tier', tier)) from profiles;
```

## 3. Invite code rotation (after `200000`)

Generate the code locally (e.g. `TSI-` + 8 characters from `A-HJ-NP-Z2-9`), store it in the password manager or keychain for David to hand out, then:

```sql
begin;
update invite_codes set is_active = false where is_active;   -- TETHOS-W26 (public in git) off
insert into invite_codes (code, term, is_active) values ('<new code>', 'Fall 2026', true);
commit;
```

Send it through the management API as in step 2 and delete any local file that held it. After `200000`, not before: a sign-up with the new code before the backfill would be demoted by it. The code never goes into a migration, seed, script or doc (ruling 2).

## 4. Deploy

Merge the launch PR into `main`; Vercel builds production. Schema first, then code (the reverse of #40): `/api/economy`, `awardRewards` and the island need the economy, Gem-ledger and identity tables. Before merging, check the Vercel production env has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (unchanged from today).

## 5. Verification queries (read-only)

```sql
select json_build_object(
 'functions', (select json_build_object(
     'wallet_apply', to_regprocedure('public.wallet_apply(uuid,text,integer,text,text,text)') is not null,
     'admin_set_membership', to_regprocedure('public.admin_set_membership(uuid,uuid,text)') is not null,
     'invite_code_valid', to_regprocedure('public.invite_code_valid(text)') is not null,
     'signup_public_t5', position('then 4 else 5' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0)),
 'membership', (select json_agg(t) from (select membership, tier, count(*) from profiles group by 1, 2 order by 1, 2) t),
 'attendance_policies', (select json_agg(policyname order by policyname) from pg_policies where schemaname = 'public' and tablename = 'event_attendance'),
 'invite_codes', (select json_build_object('active', count(*) filter (where is_active), 'w26_active', coalesce(bool_or(code = 'TETHOS-W26' and is_active), false)) from invite_codes),
 'tables_without_rls', (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
 'definer_fns_callable_by_users', (select json_agg(p.proname order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
 'cron_jobs', (select json_agg(jobname order by jobname) from cron.job),
 'backfills', (select json_agg(key) from data_backfills)
) r;
```

| Key | Expected |
|---|---|
| `functions` | all `true` |
| `membership` | member T1 1, member T2 1, member T4 = hired count, public T5 = the rest (step 1's numbers; plus any sign-ups since) |
| `attendance_policies` | `Event attendance insertable`, `Event attendance readable`, `Users can cancel own RSVP` |
| `invite_codes` | `active` 1, `w26_active` false |
| `tables_without_rls` | 0 |
| `definer_fns_callable_by_users` | exactly `can_edit_kanban_board`, `current_tier`, `get_election_results`, `increment_invite_uses`, `invite_code_valid` |
| `cron_jobs` | `prune-cron-history`, `recruitment-sheet-delivery` (unchanged) |
| `backfills` | `["membership_launch"]` |

Staging's run of this query is in `specs/evidence/launch-fixes/flows.md`.

## 6. Smoke flows (production, after the deploy)

Signed in, on www.tethos.ca, with two throwaway accounts made for the smoke and deleted after (Dashboard → Authentication → delete user; their game rows cascade):

1. **Sign-up.** `/student/signup` without a code → profile `public`, tier 5. With the new code → `member`, tier 4. `TETHOS-W26` → refused by the page (`invite_code_valid` false).
2. **Mark member.** As T1/T2: `POST /api/admin/members/<public probe id>/membership {"membership":"member"}` → 200, tier 4; back to `public` → tier 5; a T2 id with `public` → 409.
3. **Island.** The member probe opens `/student/dashboard`: island loads, `GET /api/progression/state` and `GET /api/economy/wallet` answer 200.
4. **Chapter 1.** Claim plot, catch, donate, report to HQ: 100 coins once (`wallet_ledger` one `chapter:settle-in` row), the chapter letter in the mailbox.
5. **RSVP.** On an approved event: RSVP, then cancel: the `event_attendance` row is gone.
6. **Security spot checks** with the member probe's JWT against PostgREST (the Phase 1 list, `specs/evidence/phase1/flows.md` §9): own `tier`/`membership`/`tethos_coins` PATCH → 403; `rpc/wallet_apply` → permission denied; `invite_codes` → `[]`; `member_badges` with the anon key → permission denied.
7. **Members page.** As T1 on `/student/dashboard/admin/members`: change the member probe's tier, then active and alumni; reload: the changes stayed. Your own tier: refused ("You can't change your own tier").
8. **Recruitment untouched.** `/student/apply` loads; `select status, start_time from cron.job_run_details order by start_time desc limit 3` shows `succeeded`.

## Rollback

- **Code:** Vercel → promote the previous production deployment (instant). The old `main` code on the new schema works except invite-code sign-up: its `/student/signup` reads `invite_codes` directly, which `155300` closed, so member sign-ups by code fail until the new code is back. Recruitment doesn't use either.
- **Schema:** the migrations are forward-only (no down files). Fix forward with a new timestamped migration applied as in step 2. A full restore (Pro backup or PITR, or the step 0 dump) rewinds every write since and is David's call.
- **Membership backfill only:** restore from the step 2 snapshot:
  ```sql
  update profiles p set membership = s.membership, tier = s.tier
    from json_to_recordset('<snapshot json>') as s(id uuid, membership text, tier int) where p.id = s.id;
  ```
  Leave the `data_backfills` row in place: it keeps a reapplied `200000` from running the backfill again.
- **Invite code:** never re-activate `TETHOS-W26` (it's in git); issue another new code.
