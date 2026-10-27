# Lane: fish-tiers (epic is the old legendary; legendary fights; divine needs a team; the hook "!" and the bite sound)

Worktree `.claude/worktrees/fish-tiers`, branch `game/fish-tiers`, cut from main at c26cf77b. Agent type `uwotsi-lane`.

Read `specs/launch/v1-gameplay.md`, section "Fish tiers and fights" (David's note verbatim), first.

**Existing:**
- the reel: `web/lib/game/fishing.ts`, `fishingReel.ts`, `fishingCast.ts`, `FishingOverlay.tsx`, `FishingBobber.tsx`, `FishReveal.tsx`;
- rarity weights and the roster: `web/lib/collections/roster.ts`. Lane `catalogue-editor` made fishing read rarity, size and hours from the roster; it's on game/catalogue-editor, not on main yet, so ask the coordinator to merge it before you touch fish data;
- audio: `web/lib/game/audio.ts`, `art/audio/`;
- multiplayer: `web/lib/net/`, `realtime/src/rooms/`.

**Order:**
1. **The hook "!" and the bite sound,** for every tier.
   - The common "!" pops over the player when a fish bites.
   - Legendary: a golden "!" with effects (a glow, sparks, a little screen shake).
   - Divine: bigger still (a beam or burst, colour, a stronger shake).
   - A distinct bite sound for each, synthesized by our own script under `art/audio/` (never fetch sounds), louder and richer per tier.
   - Ship this first, on its own.
2. **Re-tier:** today's legendary fish become epic: rarity data, rare-catch drops, sell prices by rarity, the "legendaries need tier 4" rod rule (it now applies to epic). Keep players' collections and saved catches valid.
3. **The legendary fight:** a boss reel. Phases with telegraphed moves (runs, jumps, dives, sudden slack), a stamina bar, more tension, a real chance to lose it, and a big landing moment. Reuse the reel minigame and extend it. Don't build a second one.
4. **The divine team fight:**
   - A divine bite opens a shared fight: nearby players join by pressing E near you and reel together.
   - The fish's stamina only drops fast enough with a few players, and everyone who helped gets the catch credit.
   - It's server-authoritative over the realtime room. Keep the wire protocol backward compatible, write tests, and say clearly that realtime needs a Fly deploy (the coordinator does it).
5. **Which fish are legendary and divine:** David sets rarities in the Catalogue editor. It needs the Divine tier from lane `rod-gear`'s rarity ladder; ask the coordinator to merge it when it lands. Until then, propose a short list (a few legendary, one or two divine: big, iconic fish like the whale shark, coelacanth or oarfish) for David to confirm.

**Evidence:** short frame strips of each "!" and the fights, the sound files, and a two-client run of a divine fight. They go on David's review page; visual work doesn't merge before he approves.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, realtime `npm test` and `typecheck`, tsc, eslint, and one `perf:check` at the end (effects). Report after step 1 and at the end.

## Status

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/fish-tiers /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
