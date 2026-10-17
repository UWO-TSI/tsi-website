# HQ onboarding: after Bram's tour (row 312)

Decided with David on 2026-10-16. After Bram's walk-along ends at the beach, the player's next step is the HQ, where they register, get a little lore and a short tutorial.

## Decisions
1. **Host: Wren, the HQ lead.**
   - Bram's last line hands you off to the HQ ("Wren will want you signed in at HQ").
   - The tracker's next step is "Report to Wren at HQ".
   - Wren meets you inside and runs the whole visit.
2. **Registering means both of these:**
   - **Sign the island register.** A short in-world moment at the HQ desk: you sign the register with your world name, which is confirmed (real names never show). That makes you a resident. Your friend code is issued and your mailbox is set up, and Wren tells you about both in one line each.
   - **Your real club membership.** Wren explains that you're part of the real club. She teaches real-event check-ins: at a real TSI event you enter the check-in code, and that's what levels you up and earns rewards. Use the existing check-in flow; this is a guided intro plus where to find it, not a new system.
3. **Lore, kept light. Two beats only:**
   - **Real life counts.** "The island measures you by what you do out there, not in here." Lore and the XP doctrine (principle 3) are the same fact.
   - **The Founder.** You see the Founder's empty desk and the plaque. Only David writes the plaque text. Until he does, it shows a draped or blank plaque, and Wren says the Founder left it for whoever came next. Write no Founder words ourselves.
   - Follow `specs/lore.md`: never resolve the war, never name the player's substrate, no school vocabulary.
4. **The HQ tutorial teaches:**
   - **The Esc menu:** map, quests and journal, bag, friends and mail. Wren asks you to press Esc and open the map.
   - **Club goals and the notice board:** the board, the club goals, and how the café and museum funds grow from real activity and deliveries.
   - **Real event check-ins:** as in 2.
5. **Tools are unlocked by people, not handed out.**
   - David: "you unlock like bug net and stuff from npc convo and mini sub tutorial quest". After the tour you have only Bram's rod.
   - Every other tool (the bug net, the shovel, then later the axe and others, plus dash and glider as already planned) is unlocked by talking to a specific resident or Keeper, who gives you a tiny sub-tutorial quest that teaches the tool. For example: catch any bug, dig up one buried thing.
   - Each tool's quest shows in the quest tracker.
   - This replaces the starter net and shovel coming back to the wheel after the tour.
   - Existing players who already own tools keep them.

## Notes for the lane
- Build it data-driven, like the tutorial route (`web/lib/game/arrival/routes/`): an HQ onboarding script plus a table mapping each tool to its NPC, lines and quest steps. Wren's lines and each tool's lines are drafts for David.
- Pick who teaches which tool from the resident roster and `specs/lore.md` (each resident has one question). Propose the pairing; David reviews it.
- The chapter 1 steps (`settle-in`) should read sensibly after this: the plot is hidden in v1 (row 307), and "Report back to HQ" may become "Register at HQ". Any seed or copy change is a new migration.

## Built (lane `game/hq-onboarding`, 2026-10-17)
Everything below is a proposal or a draft for David unless it says otherwise.

### The hand-off
- Bram's last line: "That's the lot. Wren will want you signed in at HQ. Up the path, the big house." (`web/lib/game/arrival/lines.ts` END_LINE). The rest of his walk-along is unchanged.
- The tracker's next step is "Report to Wren at HQ", the HQ visit's first step.

### The HQ visit, as data
- The script: `web/lib/game/arrival/hq/script.ts`. Each beat: Wren's lines (by key), an optional card, and what it waits for.
- The state machine: `web/lib/game/arrival/hq/visit.ts` (pure, tested in `visit.test.ts`). It's kept on the device (`tsi.hq.v1`), so a reload resumes the beat you were on.
- Order:
  1. **Report.** E at the front desk. While you report, the desk's prompt is "Talk to Wren".
  2. **Register.** Wren's welcome. Then the register card: "Sign as" your world name. Once signed, it shows your friend code (the real one from the friends API; "Issued once you're signed in" signed out) and your mailbox ("By the plaza", with the real count of letters waiting).
  3. **The real club.** Wren covers the friend code and the mailbox in one line each, then real-event check-ins. The check-in card points to the existing flow: the QR at the event's door opens `play.tethos.ca/student/check-in`, and only real events level you up. There's no new backend.
  4. **Lore, two beats.** "The island measures you by what you do out there, not in here." Then the Founder's desk:
     - it sits on HQ's back wall, between the notice board and the lounge;
     - a study desk with its chair pushed back, and a plaque above it, its canvas blank;
     - E opens the plaque card, which is blank and says only "The plaque is blank.";
     - Wren: "That's the Founder's desk. Nobody sits there. The Founder left it for whoever came next."
     - No Founder words are written. `FOUNDER_PLAQUE` in `hq/lines.ts` is null until David writes it; the card shows his text once it's set.
  5. **The Esc menu and the map.** Wren: "Press Esc", then "Open the map". The island map now opens at HQ too, with you at HQ's door; the minimap stays outdoors.
  6. **The notice board and the club goals.** E at HQ's board opens the notice sheet. It used to do nothing there.
  7. **Farewell.** The club goals (the café and museum funds grow from deliveries at the monument and from real events), the next step (donate your first find, then come back and tell her) and where the tools are ("Odile has a spare net and Pim always has a shovel").
- Every line, the tracker labels and the card copy are drafts in `web/lib/game/arrival/hq/lines.ts`.

### Who gets it, and the server flag
- A new arrival's reward is paid under a new ledger key, `arrival:v2` (`web/lib/game/arrival/arrivalService.ts`).
  - That key is also the flag that the account's tools are taught by people.
  - Accounts that arrived before this (`arrival:v1`) or never arrived (they were playing before the opening) keep the starter net and shovel and never see the visit.
  - There's no new table and no migration.
- `GET /api/world/arrival` now also returns `taught`.

### Tools unlocked by people
- **The rules.** After the tour, a new arrival's wheel holds Bram's rod only. The tier-1 net and shovel are theirs once a resident hands them over (`TAUGHT_KINDS` in `web/lib/game/tools.ts`).
- **Server side.** The hand-over puts the tool in the inventory (`POST /api/world/tools`, `web/lib/game/arrival/hq/grant.ts`). The catch route refuses a taught member's starter net or shovel until the inventory holds it (`toolsTaught` in the collections store; `checkHeld`). A better tier owned outright works regardless.
- **The quest.** Talking to the resident swaps their usual conversation for the offer (`talkStore.script`). At its end they hand the tool over, with a toast, and the tracker shows the little quest. The catch that finishes it gets a toast: the tool is yours.
- The table is `TOOL_TEACHERS` in `web/lib/game/arrival/hq/teachers.ts`. Live rows: net and shovel. Placeholder rows: axe, dash, glider.

### Who teaches which tool (approved by David, 2026-10-17)
The pairing is approved. Each resident's question is still a draft: the roster has none yet (lore: "every resident gets exactly one question").

| Tool | Resident | Their question (draft) | Why | The quest |
|---|---|---|---|---|
| Bug net | **Odile**, the museum curator (`curator`) | "What deserves keeping?" | Wings, Latin names, the cases waiting to be filled; the Mouseion keeps rescued things | Catch any bug |
| Shovel | **Pim**, the tinkerer (`crafter`) | "What's still good in what got thrown away?" | Combs the beach, "perfectly good!"; digging up the buried hull's salvage, said sideways | Dig up one buried thing |
| Axe (later) | **Mayor Eliza** (`mayor`) | (open) | "Every board on that clubhouse was put up by someone who believed in this place" | not built |
| Dash (later) | **Juniper** (`juniper`) | (open) | Runs the beach at dawn, knows every shortcut | not built (`unlockMove` is its hook) |
| Glider (later) | **Nell** (`nell`) | (open) | Watches the sky from the lamp bench | not built (`unlockMove` is its hook) |

### Chapter copy (new migration, unapplied)
- `web/supabase/migrations/20261017010000_hq_onboarding_copy.sql` (copy only).
  - The report step becomes "Report back to Wren at HQ".
  - The summary becomes "Make your first catch and donate it to the museum, then report back to Wren at HQ."
  - Only copy still as it was seeded changes, so an admin's edit stays.
- The code mirrors it: `DEFAULT_CHAPTERS` and the step's fallback, and the HQ door's prompt "Report back to Wren".
- It's smoke-tested on a throwaway Postgres: `specs/evidence/hq-onboarding/sql-smoke.sh` and `web/supabase/tests/hq_onboarding_copy_smoke.sql`.
- It isn't applied anywhere.

### David's decisions (2026-10-17)
1. **"Seed the full roster."** `web/supabase/migrations/20261017020000_resident_roster.sql`, unapplied.
   - The whole proposed roster becomes production residents, so Odile, Pim and the rest walk the production village as they do in development.
   - It's generated from the TS (`web/lib/content/residentSeed.ts`) and registered with `lib/seedMigrations.ts`, so later roster edits go through `gen-seeds`.
   - A resident is inserted only if its slug isn't there, so one an admin made or edited stays as it is.
   - Mayor Eliza and Toren keep their names and lines. They gain the roster's post, bio, tone and routine, but only where those are still as seeded.
2. **"Take them off sale."** `web/supabase/migrations/20261017163142_catalogue_seed.sql` (gen-seeds), unapplied.
   - The tier-1 Bug net and Shovel shop rows are retired: `active = FALSE`, nothing deleted (`TAUGHT_TOOL_SLUGS` in `web/lib/wallet/catalogue.ts`).
   - Owners keep theirs; the better tiers stay on sale.
3. **The tool pairing is approved** (above). The residents' questions stay drafts.

### Still open for David
1. **The visit and the tool quests' progress are kept on the device.** The ownership is the server's. On a second device a new arrival sees the chapter, not the visit, and their tools are as the server has them.
2. **Every line, the residents' questions and the plaque text.**

### Migrations, in apply order (all unapplied; smoke: `specs/evidence/hq-onboarding/sql-smoke.sh`)
1. `20261017010000_hq_onboarding_copy.sql`: chapter 1's report step names Wren.
2. `20261017020000_resident_roster.sql`: the resident roster in production.
3. `20261017163142_catalogue_seed.sql`: the tier-1 net and shovel off sale.

### Evidence (headless, `specs/evidence/hq-onboarding/`)
- **How it was shot.** `shoot.mjs` plays the whole thing end to end in one session with `?arrival=1`, signed out against a dev server with the Supabase env blanked: Bram's tour, the HQ visit, then Odile's net quest. It writes its frame log, `frames-flow.json`, beside the sheets; the repo ignores `*.json`, so the log isn't committed.
- **The sheets:**
  - `01-handoff.webp`: the hand-off;
  - `02-register.webp`: the register;
  - `03-club-and-lore.webp`: the check-in card, real life counts, the Founder's desk and its blank plaque;
  - `04-esc-map-board.webp`: Esc, the map at HQ, the notice board and the club goals;
  - `05-net-quest.webp`: one tool quest, start to finish;
  - `06-existing-vs-new.webp`: an existing player keeps the net and shovel;
  - `07-phone.webp`: phone size;
  - `08-tracker-each-step.webp`: the tracker at every step.
- **SQL smoke.** `sql-smoke.sh` and its output, `sql-smoke.txt`. All three migrations run in apply order; each smoke fails before its migration and passes after it.
- **The roster's cost in the village.** `perf-check.txt`: one `perf:check` with `SCENES=village`, headless, on a measurement build that walks the 10 seeded residents (`measure-build.sh` now rewrites `lib/content/loader.ts` too).
  - High: 4.30 ms, 391 draws, 594,603 of the 620k triangles.
  - Lite: 2.50 ms, 297 draws, 388,063 of 420k triangles.
  - Both are inside every budget line. The only failure is the regression gate: High's frame is +10.3% on the stale Oct 14 baseline.
- **Cost.** The Founder's desk is the only rendering change, in HQ's interior only. It's 3 existing furniture pieces: +5 draw calls in the main pass, +3 in the shadow pass and about 3.6k triangles. Measured with it: HQ draws 135 calls and 47k triangles, at 6.9 ms a frame. No perf bench covers HQ, so there was no perf:check.
