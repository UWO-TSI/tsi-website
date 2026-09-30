# Hardening: chapters 3–4 end to end, server-rolled catches, admin follow-ups (staging, 2026-09-29)

Dev server on `:3110` from the `game/hardening` worktree under the shared lock (17:44–17:59 EDT), env = staging keys only (fetched from the management API into a gitignored `web/.env.staging.local`, deleted after; the worktree's `.env.local` link to production was moved aside for the run and put back). Accounts: the phase 1 `member` (T4, Juniper, Oracle family Warden), `staff` (T2) and `public` (T5, Pebble), signed in with GoTrue password grants and the `@supabase/ssr` cookie, so every call went through the real Next routes → service → store → staging Postgres. Readbacks through the management API. Scripts: `flows.mjs` (API), `world.mjs` and `shots.mjs` (headed Chromium).

**Staging before the run:** `20260926210000_combat_kits` was missing (production has it); applied with this branch's `20260929100000_catch_rolls`, `20260929100100_moderation_log` and, after the fix below, `20260929100200_chapter4_subclass_copy`, one transaction each, all `[]`.

## Results

| # | Flow | Result | Log |
|---|---|---|---|
| A | Catches rolled by the server: forged species/size refused, wrong place, too fast, one harvest per node per hour, land once / own roll only | Pass (11/11) | `flows-run-1.txt` |
| A' | The same in the world: E at a shell, cast from the south shore, bite, reel won, catch card shows the server's species and size; a second E at the node in a fresh browser is refused | Pass | `world-run.txt`, W-01..03 |
| B | Chapter 3 *Fund the museum*: coins + a server-rolled specimen, refused early, can't skip, member can't credit, staff credit to target, ready → complete, regions, letter to all | Pass (13/13) | `flows-run-1.txt` |
| C | Chapter 4 *Reach the ruins gate*: Oracle done → level 10 → subclass → ready → complete, 300 coins once, regions | **Pass after fix** (before: C5, C6, C9 fail) | `flows-run-2.txt`, `-3-before-fix`, `-4-after-fix` |
| C' | The museum and the ruins gate open in the world | Pass | `world-run.txt`, W-04, W-05 |
| D | Moderation audit log, mute → unmute, T1/T2-only reads, the five older routes on the gate | Pass (18/18) | `flows-run-2.txt`, H-01, H-02 |

## Chapter 3 (member, then everyone)

`GET /api/progression/state`: chapter 3 `active` after 1–2. `complete` → 409 "The club goal isn't complete yet."; `skip` → 403. Delivered 10 coins and the `fish_horse_mackerel` the server had just rolled and landed (A6–A9) as a specimen: 110 points, the contribute step done. The goal stood at 610/15,000; staff filled it with `POST /api/progression/goals/fund-museum/credit` spread over five staging accounts (3,000 member cap, row 102); the member's own credit call → 403. Then: goal complete, chapter 3 `ready`, `unlocked_regions` has museum and woods for the member **and** for the public account (its chapter 3 still `locked`: club goals open for everyone). `complete` → 200 `completed`; again → 409. `letters`: "The museum is open", `goal:fund-museum:0`, 9 rows (every account), in the public account's mailbox. In the world the museum opens (W-04).

## Chapter 4 and the defect found

`state`: chapter 4 `active`, Oracle quiz done (class Warden). `complete` → 409. Combat gate: level 3, closed. Staging fixture: XP to the level-10 threshold (11,625, with `level = combat_level_for_xp`; combat XP normally comes from missions). `POST /api/combat/subclass` druid → 200; the combat gate opens (`gateOpen: true`).

**Defect:** chapter 4 stayed `active` with `family_trial: open`, so the gate letter, the regions and the 300 coins could never happen for anyone. Nothing in the code or database ever sets `member_quest_prefs.family_trial_completed_at` (0 rows on staging), and row 207 says there is no family trial: the level-10 moment is the subclass choice. **Fix** (`89c3f56d`, fail-first `lib/progression/supabaseStore.test.ts`): the chapter facts read `member_progression.subclass` (the flag still counts), and the seeded step/summary say "Reach level 10 and choose your subclass" (`20260929100200`, untouched seed text only; smoke checks an admin's edit is kept).

Recorded both ways on staging with `reset-C` (subclass cleared, XP back to 480, the chapter-4 row deleted; a fixture): the pre-fix `supabaseStore.ts` → C5/C6/C9 FAIL (`flows-run-3-before-fix.txt`); the fix → all pass (`flows-run-4-after-fix.txt`). First completion paid 300 coins (425 → 725, `chapter:ruins-gate`); after the reset the completion replayed the key and paid nothing, as it should. Regions: cliffs and ruins_gate. In the world the gate lets the member through with the Druid kit (W-05).

## Catches in the world

`world.mjs` spawns the member with `?at=` beside `shell-3`, presses E: `POST {"action":"harvest","node":"shell-3","at":[-8.3,-16.25]}` → 200 `shell_asari` 5.9 cm, toast "NEW! Got Asari Clam, 5.9 cm!". A second browser the same hour still showed the shell (the harvested mark is per browser) and got "You've already gathered here this hour." (W-01). At the south shore: hold E, release (`cast` with the meter's power) → 200 roll `sea_sea_star` 9 cm; E on the bite; the script plays the reel (hold while the fish is right of the bar) → `land` 200, the card shows Sea Star 9 cm (W-02, W-03). A lost reel sends no `land` and records nothing (run 1, garden eel).

## Admin

The public account reports a note from the member; T4 → 403 on the queue; staff remove + mute 7 days; the member's next note → 403 "You can't post until …"; the member shows under **Muted now**; staff unmute (`/api/identity/moderate`); the member writes again. The log returns both entries with actor, target, item and excerpt; PostgREST as the member reads 0 rows of `moderation_log`, as staff 1. In the UI (`shots.mjs`): the public account muted, H-01 shows it under Muted now with an Unmute button (and one beside its reported note); the script clicks Unmute → "Pebble (Phase1 Public) can write again.", Muted now (0), the audit log lists every action (H-02).

Older routes: NPC spend T4 → 403, T2 → 200 (was T1-only); `POST /api/economy {action: "award"}` → 400 (gone); `/api/economy/admin/award` T4 → 403, T2 → 200 (1 Gem); directory: T4 active members only, staff all.

## Staging data left behind

Member (phase1-member): chapters 3–4 completed, 300 coins, subclass druid at level 10 (XP fixture), `onboarding_completed = true` (fixture: the world redirected to onboarding), catches (rock clay, horse mackerel, asari clam, sea star), 1 Gem. `fund-museum` complete (admin credits on five staging accounts, notes "hardening E2E fill"). Notes, a removed note, moderation log rows, the public account muted then unmuted. Nothing on production was read or written.

## Seen, not in scope

The player's name tag shows "Lv. 1" in the village and the ruins while the combat level is 10, and in the ruins it reads "You" instead of the world name (W-05). Not investigated.
