# Performance: the process

David, 2026-10-08: "for character effects, i want you to let me know if having them decrease performance, and i want
to really pay attention to performance as more things are added and since its multiplayer".

The game is a multiplayer island: whatever one player's character draws, every other player in the shard draws too,
up to 40 a shard (12 at full detail on High, 8 on Lite). A small cost per character is a big one per scene. So every
change that adds visuals is measured before it merges, against a budget.

## The rule

**Every change that adds or changes visuals or effects (a character effect, a held item, a mesh, a particle recipe, a
post pass, a shader, a building, a UI overlay drawn per player) must:**

1. **Pass the budget tests** (`npx vitest run lib/game/perf`; they are in the normal gate). A new GLB, particle pool or
   effect over its budget fails there, naming the asset and the budget.
2. **Run `npm run perf:check`** on the committed change and put its table in the change's report, before and after
   (the baseline is the before). It fails on a regression over 10% in a scene's median frame time or draw calls, or a
   scene over its budget.
3. **Stay within the budget** (`budget.md`, `web/lib/game/perf/budget.ts`). If it can't, the report says **why**, **what
   it costs** (the perf:check rows, and for a character effect the `fx-bench.mjs` row at 12 and 24 players) and **the
   cheaper version** considered; David decides. A raised budget or a new `ASSET_EXCEPTIONS` entry is a decision, never a
   silent edit, and it is named in the report.
4. **Character effects:** say whether the effect costs performance, in plain numbers (frame CPU, draw calls, GPU,
   memory at 12 and 24 players: `fx-bench.mjs`), and add its switch to `lib/game/perf/fxBench.ts` so the next pass can
   price it. An effect never adds a light (a light appearing recompiles every lit material in the scene).

Changes that touch no visuals (server code, UI forms, data) skip steps 2–4.

## How to run

`perf:check` (about 10 minutes; the machine is shared, so it measures several runs and takes the median):

```
cd web
npm run perf:check                      # build, bench village / v2 world / café / ruins on High and Lite, compare
npm run perf:check -- --update          # the same, then write the medians to specs/perf/baseline.json
SKIP_BUILD=1 KEEP_BUILD=1 npm run perf:check   # re-bench the build already in web/.next
LOCK_OWNER=<branch> npm run perf:check  # agents on the shared Mac mini: takes the heavy lock to build, the devserver
                                        # lock to bench, releases each when done
```

- It builds the **measurement build** (`measure-build.sh`: a production `next build` with the development gates lifted
  so the lab scenes, `?bots=` and the probe exist). Commit first: the build rewrites and restores the gated files and
  refuses to run over uncommitted changes in them. The build in `web/.next` is deleted at the end (never deploy it).
- The bench is `perf-bench.mjs`: headed Chrome for Testing off to the side (`--window-position=2400,0`), muted, the real
  GPU (ANGLE on Metal), never brought to the front, 1280 × 800 at DPR 1, uncapped so the frame time is what a frame
  costs. Scenes: the village with 24 bots, the terrain v2 world draft with 24 bots (`?fixture=v2`), the café with 24
  bots, the ruins fight with Shadow Garden's ults.
- Runs default to 3 per scene and tier; a scene that looks regressed is re-run twice more before it is judged. The
  table shows the spread between runs and the load average: a spread over ~15% or a load over ~8 means the numbers are
  soft; run it again on a quieter machine before believing a small regression.
- Draw calls and triangles move only with what is drawn (a few percent from where the bots happen to walk). Frame time
  moves with the machine's load: trust a 10% change in frame time only when the spread is small. Frame times are
  rounded to 0.1 ms by the browser's clock, so the café's 1–2 ms scenes move 5–15% from rounding alone; their draws are
  the steadier signal.
- How noisy it is: the run straight after the baseline (no change between, load 3.3–5.3) moved every scene's median
  frame by 0–4.8% and its draws by 0–3.6%, and passed. With a baseline doctored to 400 draws and 3.4 ms for the
  village, it re-ran the village twice and failed naming both (+15.8% draws, +20.6% frame).

**Refreshing the baseline:** after a change that was meant to cost more and was accepted (its report says so), or after
a change that made things cheaper, run `npm run perf:check -- --update` on the merged `main` and commit
`specs/perf/baseline.json` with the reason in the message. On another machine set `PERF_BUDGET=off` (the frame budgets
are the reference machine's) and keep a baseline of that machine's own.

**Pricing a character effect** (`fx-bench.mjs`, `effects-cost.md`): every other player's effect can be switched off or
forced on for everyone in view (`lib/game/perf/fxBench.ts`: `?fxoff=all`, `?fxforce=ghost`, or `window.__fx.set`), with
the players stood in a block in front of you. The bench measures each effect against the base (every effect off) in
interleaved pairs:

```
sh specs/perf/measure-build.sh            # under the heavy lock
cd web && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=perf-bench SUPABASE_SERVICE_ROLE_KEY= npx next start -p 3158 &
N=24 REPS=3 PORT=3158 node ../specs/perf/fx-bench.mjs ../specs/perf/runs/fx-n24.jsonl
node ../specs/perf/fx-table.mjs ../specs/perf/runs/fx-n*.jsonl
```

**Pricing a world change** (a sky, the grass, anything every frame draws whoever plays): `world-bench.mjs` measures
switched-off or retuned variants between as-shipped samples in the village and the v2 world (`effects-cost.md`, "World
costs"); `PIXEL=0 W=1920 H=1200` runs it with the GPU's share of the frame larger, closer to a weaker machine. Add a
switch for the new thing to `lib/game/perf/fxBench.ts` (`WORLD_KEYS`) or a tuning value it reads.

## Files

| File | What |
|---|---|
| `budget.md`, `web/lib/game/perf/budget.ts` | The budget: scenes, characters, effects, assets, particle pools, network |
| `web/lib/game/perf/budget.test.ts` | The deterministic checks (normal vitest gate) |
| `perf-check.mjs`, `baseline.json` | The regression gate and its committed baseline |
| `effects-cost.md`, `fx-bench.mjs`, `fx-table.mjs` | What each character effect costs at 1, 12 and 24 players |
| `world-bench.mjs` | What the sky dome, the grass and the title screen cost |
| `perf-bench.mjs`, `ab.sh`, `measure-build.sh`, `table.mjs` | The scene bench, interleaved before/after, the measurement build |
| `2026-10-baseline.md`, `2026-10-results.md` | The first performance pass |
| `2026-10-v1-results.md`, `lite-sim.mjs`, `draw-breakdown.mjs` | The v1 pass: held items, the fishing rig, the leaf, the world by block, Lite; a weaker laptop simulated; where a scene's draw calls go |
