# Lane: wharf-art3 (the fish shop's sell stall)

Worktree `.claude/worktrees/wharf-art3`, branch `game/wharf-art3`, cut from `game/terrain-v3` at 148c7312. Agent type `uwotsi-lane`.

**David's references (2026-10-26):** `specs/references/terrain/fish-shop-2026-10-26/README.md`, with his words and the images.
- He wants the quick-sell spot in front of the fish shop to look like `sell-stall-fisk.jpg` and `sell-cart-coco.jpg`: a lively, colourful fish stall, not a lone barrel.
- `fish-bar-shark-shack.jpg` is his example of a fish bar or fish shop. It's context for later; this lane doesn't remodel the fish market.

**Read first:** that README and the images; `specs/lanes/wharf-art2.md` (how `sell-barrel` and the fish market were built and registered); `art/props/propkit.py`, `paintkit.py`; `web/lib/game/propModels.ts`, `defaultIsland.ts` (`PROP_FOOTPRINT`, `PROP_TOP`), `perf/budget.ts`.

## Next

1. **The sell stall**, replacing the file of `sell-barrel` (same name, so terrain-v3's placement and the sell interaction keep working):
   - a wooden display crate tilted toward the buyer, heaped with colourful fish, a crab, an octopus and a starfish;
   - a barrel and a tub of fish beside it;
   - a sign frame over it with a net and rope, with seagulls perched on it (scenery, no animation needed). The sign has a fish symbol or "SELL", never a brand;
   - a lantern or two, which glow at night through `NEW_LAMPS` or emissive, cheaply;
   - a life ring;
   - optionally, two stools and the cart's colour from `sell-cart-coco.jpg`.

   It reads at a glance as "sell your fish here". Bright, cartoony, our style, low detail where it doesn't show. One or two materials if possible, under a sensible budget row.
2. **Report:** the commit; triangles and size; the new footprint and top (the old one was [0.66, 0.78]); where the front faces; and the preview at `specs/evidence/wharf-art3/sell-stall.webp`. Update Status, then stop.

## Rules

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>` under `LANE=game/wharf-art3 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`. Use `withlock.sh heavy` for vitest and tsc. Never open the Blender app, and never use the `blender` MCP tools.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **Art:** never fetch art, textures or references, and never use asset libraries or generators.
- **Default village:** unchanged.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees. Don't edit `generate.ts` or `web/data/world/`.
- **Text:** no em dashes; real names never show in game.
