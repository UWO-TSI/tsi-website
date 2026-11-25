# Lane: moderation (public chat for the December 20 opening)

Worktree `.claude/worktrees/moderation`, branch `game/moderation`, cut from `feat/game-default-island` at the commit that adds this file. Agent type `uwotsi-lane-light`. Dev port 3489.

## Why

On December 20 strangers chat with strangers (`specs/launch/blockers-dec20.md` §4). Players are 13 and up, and many are under 18.

## What exists (start here, don't rebuild)

- **Reports and blocks:**
  - `web/lib/world/service.ts` (reports and blocks for world chat, `specs/multiplayer.md` §6, row 298);
  - the routes `web/app/api/world/report`, `web/app/api/identity/{report,moderate}`, `web/app/api/admin/moderation`, `web/app/api/study/chat/[id]/report`.
- **The filter and the limit:**
  - the profanity filter `web/lib/moderation/profanity` (used by the name check, `web/lib/identity/names.ts`);
  - the chat meter `realtime/src/rooms/chat.ts`.
- **The UI:** the player card (`web/components/game/net/PlayerCard.tsx`, which has a block confirm), `FriendsSheet` (a Blocked tab), `ChatDock`.

## Build

1. **The flow end to end:**
   - With two accounts (local dev, in-memory services or staging Supabase, never prod), report a chat line and report a player.
   - See each arrive where a mod can act. Mute the player, and remove them (a ban).
   - Write down every step that fails or is missing, and fix it.
   - Confirm a mod action takes effect live on the realtime server, not only after a rejoin.
2. **The filter everywhere text is shared:**
   - world chat, island names, letters, guestbooks, party and club names, notes on the notice board: anything another player reads.
   - One filter (the existing one), server side, so a modified client can't skip it.
   - Chat lines with a filtered word are masked, not silently dropped.
   - Contact details are blocked in public chat (emails, phone numbers, @handles), as the terms ask (`web/content/legal/terms.md` §3).
3. **Rate limits:**
   - Check the chat meter's numbers against a real typist and a spammer.
   - Add limits to letters, guestbook entries and reports (so reports can't be used to flood mods).
4. **Reports go where mods look:**
   - Each new report posts to a Discord channel through a webhook: who reported, who was reported (world names and ids, never real names or emails), the line and its context, the time, and a link to act in admin.
   - The URL comes from an env var, `DISCORD_REPORTS_WEBHOOK_URL`. Unset, it skips quietly and logs once. Never commit a URL.
   - If Discord fails, the report is still saved.
5. **Players protect themselves:**
   - Block works from the player card and the chat line.
   - Add a **mute**: hide a player's chat and emotes for you without blocking them, undoable from the same places. Persistent, like block.
   - Both are one tap and need no mod. Flat kit only (rows 334 and 335).
6. **The mod one-pager** (`specs/launch/mod-rules.md`):
   - what gets a warning, a mute (with lengths) and a ban;
   - what to do with anything that suggests a child is at risk (escalate to David the same day);
   - how to act in admin.
   - Plain words, one page. It's a draft for David.
7. **Who is a mod:** how a mod account is granted today (a role on the profile?). If there is no clean way, add one an admin can set. David names the mods.

## Rules

- Never touch production. Local, in-memory or staging only.
- Real names never show anywhere a mod or a player sees, Discord included.
- No secrets in the repo.
- Headless only.
- Use the heavy lock for vitest and builds.
- Ports: never 3000, 3300, 3301 or 3390.

## Evidence and gates

- **Evidence:**
  - `specs/evidence/moderation/`: the end-to-end run as a log and screenshots (report, mod view, mute, ban taking effect live);
  - a sample Discord payload as JSON, with fake names;
  - the filter's test table (words and contact details, masked and passed);
  - the mute and block UI, desktop and phone.
- **Gates:**
  - tsc in `web/` and `realtime/`;
  - vitest in `web/` (new world, once) and in `realtime/`;
  - lint on touched files.
- **Migrations:** one new migration if mute or the mod role needs a table, timestamped after the newest in `web/supabase/migrations/`.

## Status

- Not started.

## Next

1. Read this file, `specs/launch/blockers-dec20.md` §4, `specs/multiplayer.md` §6, then `CODEMAP.md`'s multiplayer rows.
2. Build steps 1 to 7.
3. Update this file, commit and report: what was broken, what you fixed, the migration if any, and the questions for David.
