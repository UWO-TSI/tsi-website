# Development roadmap: Tethos member game

Written 2026-09-26 after the vision interview (decisions 1–231 in `game-world-development-plan.md`). The interview is paused. This file sequences the build from here to a launchable first version, then the two named follow-ups: NPC personalities and multiplayer.

## Direction

Ship a cozy seaside club village that members and the public want to open daily: real campus time and seasons, fishing, bugs and foraging worth doing on their own, a study cafe that pays for studying, a home to decorate, a TSI-building quest line with club-wide goals, and an optional arcane ruins area. Low-poly 3D characters on one rig. Everything persists across devices on one Supabase backend with one wallet. After launch: NPC personalities with memory, then multiplayer.

The coordinator (Claude) runs this without check-ins (David, 2026-09-26): verified PRs are merged and deployed, matching production migrations applied and checked, and David hears outcomes. The only things that wait on David are art verdicts he owns, spending money, and anything destructive. Supabase Pro is not needed for development (the second free project is paused, so staging fits the free plan); upgrade production to Pro in the week before launch for no-pause, bigger compute and restorable backups. David pre-approved the upgrade (2026-09-26, "use pro when we need"): the coordinator upgrades at launch or earlier if production pauses or hangs under load; if the dashboard needs a payment step only David can do, that is the one hand-off.

## Status board (updated 2026-09-26)

| Track | State | Exit check |
|---|---|---|
| **Look development (main track, row 235): sunny Nintendo-style feel, not flat** | Baseline + diagnosis + `/lab/look` **merged**: fill ≈ sun (1.42:1), grey-cyan sky/air, weak hidden shadows, all-matte materials, washed grass; "Open-air sun" preset reaches ~3.5:1. **Open-air sun applied game-wide and merged**: key:fill 1.42→3.99, lit:shadow 1.92→3.79, sky saturation 0.20→0.63, derived phases/weather/seasons; water glints + glass/metal reflections **merged** (sea at golden hour 0.3%→2.0% sparkle, no FPS cost); interiors deferred by David; his screenshots refine it | David picks a preset from his references; applied to the game with a before/after |
| Production security | **Done.** #40 (profile self-promotion, Gems, email reads) and #41 (portal table writes; marketplace buys via server) merged, deployed and verified in prod | Rolled-back role tests pass in prod |
| Phase 0: commit, merge `main`, timestamp migrations, push, draft PR | **Done.** 18 commits, contains `main` through #41, 834 tests, draft PR #42 (stays draft until launch) | Branch pushed, contains `main` (incl. #40/#41), tsc/tests green, applicant + member island screenshots match |
| Character outfits + clips on the locked v6 base | **Done.** 33 parts, 23 clips, catalogue | Catalogue + evidence sheets, every clip verified |
| Ponytail cleanup + game-side security (member_collections self-edit → sell exploit, economy_sell retry race, legacy Gem writers, class badges after 034, game code vs the #40 guard) | **Done, merged** (`becb580`): 4 exploits closed with fail-first tests, −2.4k lines, 862 tests | Audit items applied as small commits; exploit tests fail before, pass after |
| Character in engine (rigged model replaces sprite; creator + wardrobe use the catalogue) | **Done, merged** (`c011a35`): one rig for player/residents/applicants, creator, wardrobe, emotes, combat clips; 854 tests | Player, residents, applicants on one rig in `/lab/island` and the applicant island |
| Study in the world | **Done, merged** (`c977ef7`): cafe interior placeholder, 2 outdoor tables, sit/start/stand, overhead timers, walk-away settlement, grey fitting room fixed | Sit → study → coins → walk away ends session, in the cafe and outdoor tables |
| Crafting | **Done, merged** (`0e98713a`): 31 recipes, HQ workbench, beach bottles, branches, crafted rods 4–5 |
| Study × character integration (rigged seat-mates, sittable benches, bed Sleep, Dig, `avatar_config` drift migration, HUD on short screens) | **Done, merged** (`86923dc6`): rigged seat-mates, benches, bed, Dig, `avatar_config` migration, short-screen HUD; 877 tests | Seat-mates and the player use the rig at every seat | ~30 recipes learnable and craftable; rods 4–5 unlock |
| Staging Supabase + signed-in E2E (Phase 1) | **Done, merged** (`1ada8162`): drift reconcile (004 never ran in prod, 005/007/008 missing, 011/020 partial), 4 fixes with fail-first tests, all flows pass on staging, 46 security checks | Every Phase 1 flow passes signed in |
| Polish: ownership (wardrobe/decorate read owned items, free starters granted once), cleanup follow-ups in DefaultIslandWorld/study | **Done, merged** (`9cb1f58b`): 885 tests; `avatar_config` now server-only | Nothing the shop sells is free outside the starter set |
| Props and enemies art (original weapons, 8 enemies, workbench, bottle) | **Done, merged** (`97192958`) | No dump stand-ins left in the ruins or crafting |
| Server-authoritative catch rolls (catches are client-reported with hourly caps today) | Backlog, before launch | Server rolls species/size; client only requests |
| Combat content A: roster, telegraphs, guardian statue boss, 10 missions, crafted weapon stats | **Done, merged** (`df3d884d`): full roster, shared telegraphs, guardian boss (3 patterns, stagger, enrage), 10 missions, crafted weapon stats, server-side gate; 902 tests | Every enemy and the boss fight in the ruins; each mission template playable |
| Combat content B: 16 kits, level-10 subclass choice, stat allocation | **Done, merged**: 16 kits from data on one ability system, caps, 4 incantations, path sheet, allocation; every subclass clears a solo mission, Warden most reliable; 979 tests | Every subclass clears a normal mission solo |
| Character art pass 2 (crafted wearables, real Stretch clip, beanie/cap/backpack/skirt fixes) | **Done, merged** (`f838efb8`) | Every craftable wearable is wearable |
| Launch-readiness fixes (membership default/backfill, public tier 5, un-RSVP, atomic chapter rewards, launch runbook) | **Done, merged**: membership backfill (43 members / 272 public, rerun-safe), public = T5, un-RSVP, retry-safe chapter rewards, admin members editor via a T1/T2 server route, `specs/launch-runbook.md`; 915 tests | Fail-first tests; staging reruns pass |
| Audio pass (sound on, settings, 12-block hourly music player, ambience, SFX map) | **Done, merged**: sound unlocks on first gesture everywhere, Sound settings, 12 real-time blocks with fallbacks until Suno tracks arrive; 932 tests | Chime and music play by default; blocks follow real time |
| Phone companion (Study/Club/Me shell, 3D table view) | **Done, merged**: shell, shared study session, table view (live 3D still to verify on a real phone); 1014 tests | Phone member can study, see club tools, profile, bag, journal, mail |
| Admin pass (shared T1/T2 gate, mark-member UI, merch staff screen, moderation queue, residents/recipes/events editors) | **Done, merged**: one T1/T2 gate for all 17 admin routes (test fails on any bespoke tier check), draft-save hole closed, mark-member, moderation queue, residents/recipes/seasonal-events editors, admin index; full SQL chain green (26 game migrations) | Every admin route behind one gate; staff can run the club's content without code |
| **Launch routing:** the new island lives only at dev-only `/lab/island`; `/student/dashboard` still serves the legacy GameWorld. Promote DefaultIslandWorld to the member route, retire the legacy world, keep `/lab/*` dev-only | Running (branch `game/launch-routing`), spec `specs/launch-routing.md` | Members reach the new island from the portal in production builds |
| Seasonal events, chapters 3–4 check, server-authoritative catches | Later waves | Per spec in `specs/` |
| Launch (Phase 4) | After all of the above | Member playtest, David's local review, migrations in one window |

Waves run at most three code-writing agents at once (Mac memory). The account's session limit has stopped all agents twice; lighter, well-specified tasks run on Sonnet to spread the load, and agents commit early so an interruption loses little. Each area: spec in `specs/<area>.md`, one fresh agent, questions in `specs/<area>-questions.md`, coordinator review, merge.

## How the work is run (David, 2026-09-26)

- **Fresh, focused subagents.** One agent per area or deliverable, started from a written spec, reporting back once. Long-lived agents that accumulate context across areas are retired after their current deliverable.
- **Ownership stays disjoint.** Two agents never edit the same directory at the same time. After Phase 0, parallel code agents each get their own worktree (short-lived branch off `feat/game-default-island`) and merge back when green.
- **Ponytail when code gets messy.** A read-only Ponytail audit runs after each burst of feature work; a cleanup agent applies it as its own small commits with tests unchanged. The skill lives at `~/.claude/skills/ponytail/SKILL.md`.
- **Memory limits on the Mac mini.** One dev server and one headless browser at a time across all agents, no local Docker stack, at most three code-writing agents at once. Read-only agents do not count toward the three.
- **Questions never block.** Agents write questions to `specs/<area>-questions.md`, keep going on what is decided, and the coordinator relays them to David.

## Phase 0: make the work safe (approved 2026-09-26)

Done so far: the whole uncommitted tree (minus `specs/evidence/`) is snapshotted as `wip/game-snapshot-2026-09-26` and pushed to origin, without touching the working tree. The executor follows `specs/phase0-plan.md` once the running agents finish their current deliverables.


Nothing below is committed. One lost worktree loses two weeks of work. This phase comes before any new feature.

1. **Commit in logical slices** on `feat/game-default-island`: island core, seasons and weather, progression, homes, collections, study, economy, oracle and identity, character art, specs and evidence. Each commit builds and passes tests on its own.
2. **Merge `main` into the branch.** 140 of the branch's game files differ from `main`. The applicant island on `main` shares rendering code with the member island, so conflicts will cluster in `web/components/game/` and `web/lib/game/`. Resolve toward the branch where the branch ported `main`'s newer look, and keep every recruitment file from `main` untouched.
3. **Reconcile migration naming.** `main` switched to timestamped migrations (`20260916…`, `20260918…`). Rename the drafts to timestamps after `20260918230000` in dependency order: 024, 025, then 029–035. Delete the stray Finder duplicate `…project_rows 2.sql` on `main`.
4. **Push the branch and open a draft PR** so the work exists off this Mac. No merge to `main`, no deploy.

Exit check: the branch is pushed, contains `main`, builds, and all tests pass.

## Phase 1: prove it against a real database

Every system so far ran on in-memory stores or a throwaway Postgres. None ran signed in against Supabase.

1. **Stand up a staging database.** The production project is free tier with no branching. Options: a second free Supabase project, or the local Supabase CLI stack. Apply 001–028 plus the recruitment timestamps, then the game drafts in order.
2. **Signed-in end-to-end pass** with two test accounts, one member and one public:
   - chapter 1 through the club-goal contribution;
   - a catch, a sale and a museum donation;
   - a study session through settlement;
   - a room purchase and a decorate-and-reload;
   - an Oracle reading and a respec;
   - letters between the two accounts;
   - merch reserve, fulfil and cancel.
3. **Fix what breaks**, adding a regression test for each fix.
4. **Integrated-graphics check:** 30 FPS minimum at the Light tier on a typical student laptop (decision 39). The M4 numbers so far do not count.

Exit check: every flow above works signed in on staging, with evidence.

## Phase 2: the character and the look (runs in parallel with Phase 3)

These wait on David's reviews and supplied art. Agents never source references (row 185).

| Step | Needs from David | Output |
|---|---|---|
| Base body v6 review | Verdict | Locked base body |
| Hair library: 16 bangs, 12 back styles | Review of the contact sheets | Hair GLBs + catalogue |
| Outfits: tee/shorts base, hooded dress, 6–8 tops, 6–8 bottoms, shoes | Outfit references or approval | Outfit GLBs on the shared rig |
| Remaining 14 animation clips (sit, study, sleep, fish, forage, dig, net, emotes) | Review of the walk and idle feel | Clip set |
| Character in engine: replace the 2D sprite with the rigged model; creator and wardrobe apply real parts | None | Player, applicants and residents on one rig |
| Character creator UI (ACNH layout) at first login and in the applicant portal | None | Creator |
| Residents: 7 service posts + flavour villagers | Founders' first names and traits (row 217) | Fictionalised roster, bios, portraits, authored dialogue drafts |
| Cafe and museum buildings in Blender | Cafe interior design (row 164) | Two original buildings |
| Sky panoramas: 4 times × 5 weather | Higgsfield Basic plan or a Gemini top-up | 20 panoramas per `sky-art-prompts.md` |
| Music: 12 hourly blocks | Suno tracks (row 114) | Normalised loops wired to the real clock |
| Sound effects | Higgsfield Basic or an ElevenLabs key | SFX manifest |
| Family sigils | Sigil art, or approval to generate | Four sigils |

## Phase 3: finish the first-version systems

In rough order. Each area follows the working rule: spec, then one agent, questions back through a questions file.

1. **Combat foundation (running now):** rules, XP to level 10+, subclass data, ruins zone, encounter, incantation prototype, mission board.
2. **Combat content:** the full ruins roster (5 enemies, 2 elites, statue boss), 10 missions, 16 subclass kits playable, durability and repair, level-10 subclass choice.
3. **Crafting workshop:** ~30 recipes, learned from residents, the shop and beach bottles; rods 4–5 become craftable.
4. **Study in the world:** cafe seats and outdoor tables wired to the study hook, overhead timers, stretch-on-break, the opt-in top-studiers board. Cafe opens with the chapter 2 club goal.
5. **Phone companion shell:** study (low-detail 3D cafe view), club tools, profile, inventory, journal, mailbox.
6. **Seasonal events:** fall fishing tourney, winter lights festival, GENESIS week, spring blossom picnic, as repeating club goals.
7. **Remaining chapters:** chapter 3 museum funding opens the woods; chapter 4 opens the ruins gate after the Oracle result and the subclass choice.
8. **Admin tooling pass** gated to T1–T2 (row 215): residents, events, catalogue, palettes, goals, chapters, merch.

## Phase 4: first-version acceptance and launch

1. Fresh-account and returning-account playthroughs on the agreed devices.
2. A member playtest with real TSI members.
3. David reviews a complete local build before anything is pushed toward production.
4. Launch data reset (decision 48): reset prototype gameplay, preserve real club records and real-value balances. Audit the tables first.
5. Apply the migrations to production in one window, **then** deploy (the game code needs them: `/api/economy` and `awardRewards` depend on the economy and Gem-ledger migrations; this is the reverse of #40's order). Run the schema-drift reconciliation migration first. Before that window, move production Supabase off the free tier or add a keep-warm job; it already paused once and hung once under load.

## Later: NPC personalities (next update, after launch)

David's direction (2026-09-26): residents gain a retrieval-backed personality system, and each resident adapts to the person talking to them.

- **Fixed core:** each resident keeps an authored bio, voice and story (rows 121–123). Quests, gifts and story steps stay authored and deterministic.
- **Knowledge:** a per-resident retrieval store holding the bio, island lore, club facts, the calendar and FAQs. Retrieval uses the existing Supabase Postgres with pgvector.
- **Per-player memory:** a short, capped memory per player and resident pair. It holds past conversations summarised, friendship level, gifts, quests done, and the player's family and display name. The resident uses it to adapt tone and references.
- **Guardrails:** free-form chat is small talk only and cannot grant items, coins or quest progress. It also cannot reveal other players' data or any coin conversion. It goes through the profanity filter and the report button, and a per-account rate limit applies.
- **Model and cost:** decide the provider and a per-member monthly budget before building. The parked `sprint-2026-06-llm-npc.md` and `NPCChatOverlay` are the starting point per the reuse rule.

Open questions for when this is picked up: which provider, the monthly budget, whether memory is visible or erasable by the player, and whether phone members can chat.

## Later: multiplayer (next update, after launch)

Already decided: live home visits next update (69), guests need permission to harvest or edit (71), visible presence with personal resources (83), later PvP with separate rules (13), Colyseus rather than Supabase Realtime for position sync (`asset-stack.md`).

- **Server:** a Colyseus room per island instance (village shards, one room per home visit, one per ruins party). Supabase stays the source of truth for inventory, wallet and progression.
- **Order:** shared village presence first (positions, emotes, nameplates). Then home visits with the owner's permissions. Then co-op ruins parties. Then PvP last, with its own consent and interruption rules.
- **Study tables** already have server-side presence. They can move onto the same room system without a data change.
- **Cost check** before building: hosting (a self-hosted VPS or Colyseus Cloud) against expected concurrent users.

## Risks

- **Uncommitted work on one Mac.** Phase 0 exists for this.
- **Drift from `main`.** The applicant island keeps changing on `main` while the member island ports its code. Merge `main` in at every phase boundary.
- **Free-tier Supabase.** It paused for two months over the summer and hung under recruitment load. Launch needs a paid tier or a keep-warm job.
- **Art bottleneck.** Most Phase 2 steps wait on David's reviews and supplied references. Phase 3 is ordered so that systems work continues while art waits.
- **Principle drift.** Rows 11, 74–76, 200 and 225 override parts of the May design principles in `CLAUDE.md` (online rewards, public access, XP sources). Update `CLAUDE.md` and `STATE.md` so new agents do not follow the old rules.
