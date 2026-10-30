/**
 * The dump models the member island's world draws as our own (game/remodel, art/remodel/): the same file name under
 * /assets/game/remodel/, so one swap covers every place that names the dump's file. The critters are the cheap world
 * ones: call it only where the world draws them; close-ups (the trophy case, the icons) keep the dump's (David, 2026-10-27).
 */
const REMODELLED = /^\/assets\/acnh\/(fish\/[\w-]+|critters\/(common|tiger|agrias|monarch|peacock|emperor)-butterfly|critters\/(darner|red)-dragonfly|critters\/(ladybug|brown-cicada|grasshopper|mantis)|props\/(rock-[abc]|fence-rope-a))\.glb$/;
/**
 * Models with a high-def and a low-poly version (design bible, Models 2): the close-up (the shop's detail) loads the
 * high-def under /assets/game/items/, the world and the rod wear the low-poly of the same name under items/lp/. The
 * bobber's and the bait's lp files are copies of the high-def until their remodel lands (waiting on David's references).
 */
const LOW_POLY = /^\/assets\/game\/items\/(bobber-lucky|bait-sweet)\.glb$/;
export const worldModel = (url: string) =>
  LOW_POLY.test(url) ? url.replace("/items/", "/items/lp/")
    : REMODELLED.test(url) ? url.replace("/assets/acnh/", "/assets/game/remodel/") : url;
