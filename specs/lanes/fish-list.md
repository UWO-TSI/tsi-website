# Lane: fish-list (what you can catch, and why)

Worktree `.claude/worktrees/fish-list`, branch `game/fish-list`, cut from `game/fishing-depth` at 92cd709f (it has round 5's seasons; merges after fishing-depth). Agent type `uwotsi-lane`. Docs only this round.

## David's call (2026-11-02)

"i need you to expand this fishing catagory". Asked what he meant, he picked: "The fish list: do for fish what the treasure page did for digging: every fish with its rarity as a percentage, where and when, what it's for (crafting materials for class gear, the tasting book, the aquarium), plus new fish to fill the gaps. A list for you to mark first, nothing built."

His treasure notes the same night set the direction (verbatim): "give the percentage too for the rarity, more rare core crafting ingredient, like a few more legendary item to make legendary gear for mage, marksman, and the classes", "legendary and divine gear digs should have like a glow or aura to it", and for the tasting book: "every new fish you find you can cook it for a very small perm fishing buff ... it can unlcok dishes taht are temp big buff but require ingredients and expensive".

## Round 1: the list

1. **Read what exists:** the roster (`collection_species` rows with the rod tool, the catalogue seeds, `web/lib/collections/`), each fish's water, seasons (round 5 moved them to whole seasons), time of day, weather, size, rarity and sell price; the odds (`fishPoolFor` in peaceful.ts, the rod tiers and bait), the rarity ladder, the tasting book (`specs/lanes/tasting-book.md`), the aquarium, the museum, the treasure list (`.claude/worktrees/treasure/specs/treasure.md` on game/treasure), the classes (`specs/design-principles.md`) and the lore.
2. **The table:** every fish: name, water (Sea, River, Pond, Deep sea, Cliff pools), seasons, time and weather, rarity, chance per cast as a percentage with the starter rod (and how better rods and bait shift it), sell price, and its purposes: the tasting book (cook for the permanent buff, dish ingredient), the aquarium, the museum, crafting material (scales, fins, pearls, ink...) for class gear, a resident's favourite gift, quests. Every fish needs a reason beyond coins.
3. **Gaps and new fish:** where the roster is thin (a water, a season, a time, a rarity band, a class's materials), propose new fish to fill it, with a few legendary and Divine catches tied to class gear (mage, marksman and the others), and say which ones glow (an aura material when modelled).
4. **Modelling:** which new fish are plain text prompts (Meshy then Blender) and which are important enough for David's references.
5. Output: `specs/fish-list.md` and a short report. The coordinator puts it on a review page. Never write the gem-to-money rate. Real names never show in game.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Never fetch art references.
- Commit `[build]`, never push, never bare `git stash`. No em dashes.

## Status

Not started.
