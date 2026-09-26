# SQL smoke: `20260926170000_profiles_avatar_config` (2026-09-26, study × character)

Throwaway local Postgres 16 (Homebrew `initdb`, port 55437, trust auth, deleted after). Never Supabase.

Chain, per database:
1. `web/supabase/tests/supabase_stub.sql`.
2. Every `main` migration in name order, `001_initial_schema` through `20260926130000_portal_rls_hardening` (only `020_player_persistence` reports statement errors: the known legacy achievements section).
3. With `ON_ERROR_STOP`: `20260926150000` … `150500`, `pre033_seed.sql`, `150600`, `pre034_seed.sql`, `150700`, `150800`, the security fixes `150900` … `151200`, `160000_crafting`, then **`170000_profiles_avatar_config`**. The seed files are skipped on the databases that run `main`'s own smokes (they count profiles).
4. Smokes.

`avatar_config_smoke.sql` simulates production: it drops `profiles.avatar_config`, applies the migration twice, then checks the column (jsonb, default `{}`), the SELECT grant (authenticated yes, anon no), a member saving their own look through the #40 guard, and another member reading it.

Output:
```
chain ok (game)
029 ok · 030 ok · 031 ok · 032 ok · 033 ok · 034 ok · 034 membership not self-editable ok · 034 legacy ok · 035 ok
security 1 collections ok · security 2 sell retry race ok · security 3 gem types ok · security 4 class server-only ok
crafting ok · crafting recipes not self-writable ok
ok: column re-added as jsonb, default {}, SELECT for authenticated only
ok: member saves own look
ok: another member reads the look
avatar_config smoke ok
chain ok (guard)   profiles_guard_smoke.sql … ok: final state (A still T4 / 0 Gems; B untouched by A)
chain ok (rls)     portal_rls_smoke.sql … exit 0
chain ok (look)    avatar_config_smoke.sql alone … avatar_config smoke ok
```
