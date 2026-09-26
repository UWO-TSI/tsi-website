# Evidence: polish-ownership (2026-09-26)

Screenshots (headed Chromium, `shots.mjs`, `/lab/island?crafting=demo` signed out: the in-memory inventory, shop and buy services behind the real sheets):
- `O2-01` fitting room, Tops: starter tops owned; the rest locked (dashed, 🔒), tapping one shows "sold in the shop" with **Visit the shop**.
- `O2-02` the shop sheet it opens (Outfits tab): the six hair dyes with their colour.
- `O2-03` after buying the cardigan and the pink dye (1,500 → 1,210 coins; cardigan "Owned").
- `O2-04a` back in the fitting room: the cardigan is owned and worn. `O2-04b` hair colours: six free, the bought dye worn, the other five locked.
- `O2-05` decorate inside the house: only owned pieces with how many are left (the starter room's four placed → 0 left), free finishes only, a link to the shop.

# SQL smoke: `20260926180000_ownership`

Throwaway local Postgres 16 (Homebrew `initdb`, port 55441, trust auth, deleted after). Never Supabase. Runner: `sql-smoke.sh` next to this file.

Chain, per database: `supabase_stub.sql`, every `main` migration through `20260926130000` (020's known legacy errors), then with `ON_ERROR_STOP` every game draft through `20260926170000_profiles_avatar_config` and **`20260926180000_ownership`** (the pre-033/034 seeds only on `game`). Then the smokes.

`ownership_smoke.sql`: six dyes on sale, partless outfits off sale, starter clothes never sold, 23 starter rows (9 clothes, 14 furniture), grant is service-role only; two overlapping first calls through dblink (the second blocks on the marker row) grant once; a bought lamp stacks on the starter one and a later call never tops it up; a starter tee can't be bought; a member's own `UPDATE profiles SET avatar_config` is refused by the guard while `display_name` stays editable; the server writes the look.

Updated for avatar_config becoming server-only: `profiles_guard_smoke.sql` (avatar_config moves to the refused list, 25 editable columns) and `avatar_config_smoke.sql` (the server writes the look).

Output:
```
chain ok (game)
029 ok · 030 ok · 031 ok · 032 ok · 033 ok · 034 ok · 034 membership not self-editable ok · 034 legacy ok · 035 ok
security 1 collections ok · security 2 sell retry race ok · security 3 gem types ok · security 4 class server-only ok
crafting ok · crafting recipes not self-writable ok
ownership catalogue ok
ownership starters once ok
ownership buy after grant ok
ok: member cannot write avatar_config (profiles: avatar_config can only be changed by the server)
ownership avatar_config server-only ok
ownership smoke ok
chain ok (guard)   profiles_guard_smoke.sql … ok: final state (A still T4 / 0 Gems; B untouched by A)
chain ok (rls)     portal_rls_smoke exit 0
chain ok (look)    avatar_config_smoke.sql … ok: server saves the look · ok: another member reads the look · avatar_config smoke ok
```
