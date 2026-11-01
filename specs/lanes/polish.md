# Lane: polish (creator hair change, rod shop and bag fixes)

Worktree `.claude/worktrees/polish`, branch `game/polish`, cut from origin/main. Agent type `uwotsi-lane`. Dev port 3332.

Both parts shipped in v1.2 and David reviewed them. These are his redo notes. Read `specs/lanes/creator-polish.md` and `specs/lanes/rod-gear.md` for the code map and the "Tools and gotchas" of each (shoot scripts, URLs, demo data). Their "Next" sections are stale; this file wins.

## Part A: the creator's hair change

David, 2026-10-29, creator polish review (https://claude.ai/artifact/KkE3ppKZjP7o2yP6kxg8Rx):
- cp-dissolve: "not hte effect i like, do a more chill subtle hair change thats less glitchy"
- cp-dissolve-2 and cp-top: "not hte effect i like, do a more chill subtle hair change"
- Approved: cp-calm, cp-calm-face, cp-wave.

Today's look: the composite dissolves old to new with clumpy 3 px pixel noise and a foam-cream edge (`COMPOSITE_FRAG`, `uDissolve`). Replace it with something calm and subtle: for example a soft cross-fade, or a gentle fade that follows the wave's crest, with no noise cells and no bright edge. The old you still copies the new you's bones during the sweep, so only the look changes. Same for tops. Before and after strips (hair-a, hair-b, top) with the creator-polish shoot script.

## Part B: rods (round 3 fixes, not the new roster)

David, 2026-10-29, rods round 2 review (https://claude.ai/artifact/2SriizfPH8naxzxb1SdFmn), verbatim:
- r2-bag-rod: "make the line not black and thinner more subtle, the overlay good, maybe make it a slightly different color so its more ob, also the bobber on the rod is too big "
- r2-shop-glass: "move the title and text up a bit and the graph up a bit so theres a bit space between graph and purchase"
- r2-shop-shelf: "outline could be slightly bigger"
- r2-shop-lighthouse: "the model needs a light ontop because its lightouse, "

Build:
1. The bag's rod view: the line lighter (not black), thinner and subtler; the overlay a slightly different colour so it stands out more; the bobber on the rod smaller.
2. The shop's rod card: the title, text and radar up a little, so there's space between the radar and Purchase.
3. The shelf's rarity outline slightly bigger.
4. The Lighthouse rod gets a light on top: a small lamp housing at the tip with a warm emissive glow (no real light source; emissive plus the existing bloom if any). Edit the model with a headless Blender script (a script, not hand edits), HD and LP, then run `cd web && node scripts/pack-glbs.mjs`.

Not this lane: the new rod roster (Precision, Training, Riptide, Titanium, Tempest and the re-tiering), the bait and bobber remodels, and auras. They wait for the Meshy key.

## Gates and evidence

tsc, vitest on the touched areas, eslint on changed files, headless before and after shots (desktop and phone where it's UI). One perf:check (SCENES=v2) only if the lighthouse model's triangles grow noticeably. Evidence in `specs/evidence/polish/`, then report to the coordinator for a review page.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- Locks: `LANE=game/polish /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Supabase env blanked on your dev server.
- New world only (the village is retired). No fetched art. Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail code (`specs/lane-rules.md`).

## Status

Not started.

## Next

Part A, then Part B.
