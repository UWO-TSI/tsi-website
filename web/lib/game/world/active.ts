/**
 * The dump models the member island's world draws as our own (game/remodel, art/remodel/): the same file name under
 * /assets/game/remodel/, so one swap covers every place that names the dump's file. The crawlers are the cheap world
 * ones: call it only where the world draws them; close-ups (the trophy case, the icons) keep the dump's (David, 2026-10-27).
 */
const REMODELLED = /^\/assets\/acnh\/(fish\/[\w-]+|critters\/(ladybug|brown-cicada|grasshopper|mantis)|props\/(rock-[abc]|fence-rope-a))\.glb$/;
export const worldModel = (url: string) => (REMODELLED.test(url) ? url.replace("/assets/acnh/", "/assets/game/remodel/") : url);
