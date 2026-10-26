/**
 * Our own village props (game/remodel-props; art/props/build_*.py), replacing the ACNH dump's (specs/asset-audit). Each
 * is authored in game units and drawn at scale 1 unless its note says otherwise.
 */
const P = "/assets/game/props/";

/** The beach campfire's stack: stone ring, log teepee, ember bed (components/game/campfire/Campfire.tsx). */
export const CAMPFIRE_URL = `${P}campfire.glb`;
/** The plaza mailbox and the home island's: a painted timber post box, its door toward +z. */
export const MAILBOX_URL = `${P}mailbox.glb`;
/** The street lamp (AmbientProps Lanterns, instanced): 2.67 to its finial, the lantern's glass round the light at 2.4. */
export const STREETLAMP_URL = `${P}streetlamp.glb`;
/**
 * The new world's lamps (art/props/build_new_lamps.py), each with its light point in the model (its arm reaches +x):
 * draw them with AmbientProps Lanterns' `lamp` (and `yaws` to turn the arms). The street lamp keeps the old one's top.
 */
export const NEW_LAMPS = {
  village: { url: `${P}village-lamp.glb`, light: [0.52, 2.08, 0] },
  wharf: { url: `${P}lantern-post.glb`, light: [0.56, 1.78, 0] },
  /** The campfire's lantern on a crooked branch (art/props/build_campfire_set.py). */
  camp: { url: `${P}camp-lantern.glb`, light: [0.3, 1.18, 0] },
  // game/village-art (art/props/build_path_lamps.py): the path's lamps, one iron lantern on a timber post with an angled
  // brace, or on a crooked branch post on a stone plinth; and the hand lantern alone, standing on its foot (to hang it
  // from a hook, its foot HAND_LANTERN_RING under the hook).
  woodPost: { url: `${P}wood-post-lamp.glb`, light: [0.8, 1.886, 0] },
  branchPost: { url: `${P}branch-post-lamp.glb`, light: [0.5, 1.731, 0] },
  hand: { url: `${P}hand-lantern.glb`, light: [0, 0.143, 0] },
} as const;
/** The hand lantern's ring top over its foot. */
export const HAND_LANTERN_RING = 0.542;
/** The wharf's channel buoys (wharf/Wharf.tsx): the float meets the water BUOY_WATERLINE up its model. */
export const BUOY_URL = `${P}buoy.glb`;
export const BUOY_WATERLINE = 0.66;
/** The outdoor study tables (study/StudySeats.tsx): the picnic table (2 long) and the pier's (1 long), tops at 0.84. */
export const STUDY_TABLE_LONG_URL = `${P}study-table-long.glb`;
export const STUDY_TABLE_URL = `${P}study-table.glb`;
/** The classic look of both (game/remodel-r2): the original reading table's shape and green cloth, rebuilt as ours. */
export const STUDY_TABLE_CLASSIC_LONG_URL = `${P}study-table-classic-long.glb`;
export const STUDY_TABLE_CLASSIC_URL = `${P}study-table-classic.glb`;
/** An open book, authored at the dump book's size at 0.1 (so drawn at the dump scale × 10). */
export const STUDY_BOOK_URL = `${P}study-book.glb`;

/** The club monument's "coming soon" sandwich board (DefaultIslandWorld ClubMonument, stages 0–3): 1.13 tall. */
export const MONUMENT_SIGN_URL = `${P}monument-sign.glb`;
/**
 * The plaza's notice and catch boards (and the mission board, GENESIS's poster board): the dump board kept and lightly
 * retouched (art/props/derive_plaza_boards.py, row 314), so its frame is the dump's: the origin at the board's left end
 * on the ground, the board 1.68 along +x, its notes facing +z. `back` is its back face (z), where GENESIS hangs posters.
 */
export const NOTICE_BOARD_URL = `${P}notice-board.glb`;
export const CATCH_BOARD_URL = `${P}catch-board.glb`;
export const PLAZA_BOARD = { back: 0.266 };
/** The log bench: its seat top at 0.51 inside the old bench's footprint (defaultIsland PROP_TOP, PROP_FOOTPRINT "bench-wood"). */
export const LOG_BENCH_URL = `${P}log-bench.glb`;

/**
 * The plank footbridge (the map's bridges, the editor's, GENESIS's stage deck), in the dump bridge's frame: spanning
 * x ±1.9, its rail logs and corner stumps along z ±1.27 (inside defaultIsland's rail strips), the deck's top at
 * BRIDGE_DECK_TOP.
 */
export const BRIDGE_URL = `${P}bridge-plank.glb`;
export const BRIDGE_DECK_TOP = 0.075;
/** The dump's parasol and loungers by the pier table (and the homes' Parasol), recoloured (art/props/derive_parasol.py). */
export const BEACH_PARASOL_URL = `${P}beach-parasol.glb`;
/**
 * The member clubhouse's notice board (HQInterior `noticeBoard`): the dump's metal board, its printed notes made plain
 * stickies until David's designs come (art/props/derive_hq_board.py); a remodelled piece by its own name (below).
 */
export const HQ_NOTICE_BOARD_URL = `${P}hq-notice-board.glb`;
/** The shop's trolley: a timber handcart with a wicker basket, the remodelled "shopping-cart" piece (below). */
export const SHOP_CART_URL = `${P}shop-cart.glb`;

/** Map props by the model the map stores (`bench-wood`): ours where remodelled, else the dump's. */
export const REMODELLED_PROPS: Readonly<Record<string, string>> = { "bench-wood": LOG_BENCH_URL };
/** The fish crate (art/wharf/build_crate.py): the market's, and the arrival's on the pier. */
export const CRATE_URL = "/assets/game/wharf/crate.glb";
/** The sushi bar (game/sushi-bar). */
export const SUSHI_BAR_URL = "/assets/game/buildings/sushi-bar.glb";
/** The `prop` kind's scenery outside the dump's props folder, by model name (terrain v3: the market, the beach, the lighthouse). */
export const SCENERY_URLS: Readonly<Record<string, string>> = {
  barrel: "/assets/acnh/furniture/barrel.glb", lighthouse: "/assets/acnh/furniture/lighthouse.glb", crate: CRATE_URL,
  "shop-cart": SHOP_CART_URL, "beach-parasol": BEACH_PARASOL_URL, "palm-a": "/assets/acnh/plants/tree-palm-a.glb", "palm-b": "/assets/acnh/plants/tree-palm-b.glb",
  // The new world's wharf kit (art/wharf/build_wharf_kit.py, game units at scale 1; the deck's top at y 0, the sea 1.08 under):
  // a `deck` square and its "steps" (4 x 4, local +z inland), a pile to stand just outside the deck's edge, a ladder off
  // the edge (the edge at z 0, the water toward -z), and rope fencing (a post, and a rope from x -1 to +1 between two).
  ...Object.fromEntries(["deck-tile", "deck-steps", "wharf-piling", "wharf-ladder", "rope-post", "rope-span"].map(m => [m, `/assets/game/wharf/${m}.glb`])),
  // The log bench (art/props) as a map `bench`: the new world's round the beach campfire.
  "log-bench": LOG_BENCH_URL,
  // The new world's plaza floor (art/props/build_plaza_tiles.py): stone setts in rings, 12 round, laid on the ground.
  "plaza-tiles": `${P}plaza-tiles.glb`,
  // Its palms (art/trees/build_palms.py): solid low-poly fronds in two layers, coconuts at the crown, a scaled trunk, in four
  // sizes (about 6.2, 5, 3.5 and 2 tall), the origin at the trunk's foot, at scale 1.
  ...Object.fromEntries(["tall", "lean", "short", "small"].map(m => [`palm-${m}`, `/assets/game/plants/tree-palm-${m}.glb`])),
  // Its campfire set (art/props/build_campfire_set.py), round the campfire with the log benches: a stump to sit on, a
  // firewood stack with its chopping block, a fish-drying rack (along x).
  ...Object.fromEntries(["stump-seat", "firewood-stack", "fish-rack"].map(m => [m, `${P}${m}.glb`])),
  // game/village-art: the plaza's set (art/props/build_plaza_set.py), fronts toward +z. The fountain is 9.6 across (scale
  // it uniformly to the plaza); the bunting hangs between (-2, 0, 0) and (2, 0, 0), so set it at the hang height and scale
  // x by the span / 4; the wall banner's origin is its bracket's plate on a wall in the x-y plane, the banner out along +z.
  ...Object.fromEntries(["plaza-fountain", "bunting-string", "banner-pole", "flag-pole", "wall-banner", "fruit-stall", "fruit-barrel", "fruit-crate",
    "flower-planter", "flower-pot", "round-planter", "planter-bench", "market-sign"].map(m => [m, `${P}${m}.glb`])),
  // game/wharf-art: the dock decor (art/wharf/build_dock_decor.py), on the deck's top at y 0: a roped pile standing 0.9 over
  // the deck (down into the sea, like wharf-piling), a rope net with floats between posts at x -1 and +1, a life ring upright
  // in x-y (its foot at the origin: lean it or hang it), a net heap, crates under a net and under a cloth, a crate of fish
  // tipped toward +z, and a hoist whose jib reaches along +x.
  ...Object.fromEntries(["dock-pile-rope", "rope-net", "life-ring", "net-heap", "crate-net", "crate-cloth", "fish-crate", "dock-hoist"]
    .map(m => [m, `/assets/game/wharf/${m}.glb`])),
  // game/village-art: the path's edges: mossy side rocks (art/props/build_stones.py, remodelled organic by game/village-art2;
  // scale them freely), and the loose fence in short runs along x (art/props/build_path_edge.py; leave gaps between runs,
  // the lone post fills one); and a meadow patch of wild flowers in grass and a clump of tall grass (art/trees/build_flowers.py,
  // a tile across at scale 1).
  ...Object.fromEntries(["path-rock-slab", "path-rock-low", "path-rock-cluster", "rustic-fence-a", "rustic-fence-b", "rustic-post"].map(m => [m, `${P}${m}.glb`])),
  ...Object.fromEntries(["meadow", "tallgrass"].map(m => [`flower-${m}`, `/assets/game/plants/flower-${m}.glb`])),
  // game/wharf-art: the beach set (art/props/build_beach_set.py), the origin on the ground: a lifeguard tower (its ladder
  // to +z), surfboards stuck in the sand, and coral clumps for the shallows (their foot on the seabed, not solid).
  "lifeguard-tower": `${P}lifeguard-tower.glb`,
  // game/sushi-bar: the sushi bar (art/buildings/build_sushi_bar.py), a long open bar about 9.2 by 6.1, the origin at the
  // middle of its solid kitchen core (x ±4, z ±1.5), the guests' deck and six stools toward +z, the open window onto the
  // sea toward -z.
  "sushi-bar": SUSHI_BAR_URL,
  ...Object.fromEntries(["a", "b", "c"].map(m => [`surfboard-${m}`, `${P}surfboard-${m}.glb`])),
  ...Object.fromEntries(["a", "b", "c", "d"].map(m => [`coral-${m}`, `/assets/game/water/coral-${m}.glb`])),
  // game/village-art2 (David, R2c): big mossy stones (art/props/build_stones.py), sunk a little under their origin: a
  // chiselled boulder on a broken slab (1.4 across, 0.86 tall) and a low outcrop of three stepped slabs (2.3 by 1.5).
  ...Object.fromEntries(["a", "b"].map(m => [`moss-boulder-${m}`, `${P}moss-boulder-${m}.glb`])),
  // Wild shrubs (art/trees/build_shrubs.py): loose clumps of leaf cards in different sizes and densities, never a ball, the
  // root at the origin, not solid: a full mound (a), a low spreading one along x (b), a tall loose one (c, 1.4), a small
  // sparse tuft (d), a big lush one (e, 2.2 across) and a lopsided loose pair of clumps (f). Turn and scale them freely.
  ...Object.fromEntries(["a", "b", "c", "d", "e", "f"].map(m => [`shrub-${m}`, `/assets/game/plants/shrub-${m}.glb`])),
  // game/wharf-art2: the fish market, remodelled (art/buildings/build_fish_market.py): a timber shop 5.2 by 4.2 on a stone
  // footing, front +z, a giant wooden swordfish bursting up out of its roof toward +x (the bill reaches x 5.1, top 10.6),
  // a porch out to z 3.9 over the door and a table of fish; an exterior only, the origin at the middle of its floor. The
  // sell barrel (same builder) is the quick sell: a big barrel of fish, a hanging scale and a SELL board, front +z.
  "fish-market": "/assets/game/buildings/fish-market.glb", "sell-barrel": "/assets/game/wharf/sell-barrel.glb",
  ...Object.fromEntries(["a", "b", "c"].map(m => [`reeds-${m}`, `/assets/game/plants/reeds-${m}.glb`])),
  ...Object.fromEntries(["a", "b"].map(m => [`lily-pads-${m}`, `/assets/game/water/lily-pads-${m}.glb`])),
  ...Object.fromEntries(["river-stones-a", "river-stones-b", "driftwood-a", "driftwood-b"].map(m => [m, `${P}${m}.glb`])),
  // game/wharf-art2: more for the beach (art/props/build_beach_things.py), the origin on the sand: beach balls 0.56 across
  // (scenery: nothing kicks or throws them yet), towels laid along z (0.9 by 1.8), a lounger along z (backrest at -z, the
  // sitter looks to +z), a sandcastle with its bucket and spade, a cool box, a volleyball net along x (posts at x +-2.6).
  ...Object.fromEntries(["beach-ball-a", "beach-ball-b", "beach-ball-c", "beach-towel-a", "beach-towel-b", "beach-lounger", "sandcastle", "beach-cooler",
    "volleyball-net"].map(m => [m, `${P}${m}.glb`])),
  // Single low-poly forest trees for the closed forest (art/trees/build_forest_trees.py, game/trees-art), 120 to 380
  // triangles, the trunk's foot at the origin (it runs 0.8 under), not solid. Conifers: a layered cedar (8 tall), a fir
  // (10), a slender spire (12), a broad old fir (9), one leaning to +x (8), one with a broken top (7.6), a young one (3.4);
  // broadleaves: an oak-like round crown (6.6), a pale birch (7.6), a wide spreading crown (6.2), a sapling (2.6); and a
  // dead snag (6). Scale them uniformly only (0.8 to 1.25), never stretched; the instance tint goes on mForestCrown.
  ...Object.fromEntries(["cedar", "fir", "spire", "old-fir", "leaning", "broken", "young", "broadleaf", "birch", "wide", "sapling", "snag"]
    .map(m => [`forest-tree-${m}`, `/assets/game/plants/forest-tree-${m}.glb`])),
  // Riverbank trees (the same builder), 650 to 810 triangles, the trunk's foot at the origin, solid at the trunk only: a
  // weeping willow (8 tall, sprays hung to about 2 over the ground), a tall alder (8.9), a big oak (8.7, 7.5 across)
  // and one leaning out over the water to +x (8.6 tall, its crown 4.3 out): turn it to face the river.
  ...Object.fromEntries(["willow", "alder", "oak", "lean"].map(m => [`river-tree-${m}`, `/assets/game/plants/river-tree-${m}.glb`])),
  // game/wharf-art2: coral reefs for the shallows (art/water/build_coral_reefs.py), the coral clumps above tinted and massed
  // on low rocks, the origin on the seabed at the middle, not solid: a broad (2.8 by 2), b round and tall (2 across), c a
  // long ribbon along x (3.4 by 1.2).
  ...Object.fromEntries(["a", "b", "c"].map(m => [`coral-reef-${m}`, `/assets/game/water/coral-reef-${m}.glb`])),
  // game/wharf-art4: the wharf shops (art/wharf/build_wharf_shops.py), in the ship houses' frame: the origin on the deck's
  // top at the middle of the floor, the door to +z (inland), the back over the sea on piles down to y -3.4. The tackle
  // shop: walls z -2.45 to 1.15, a porch under a striped awning to z 2.45, a giant rod on the roof whose line hangs a
  // bobber and a lure off the porch's +x corner (x 2.35, z 3.05, down to y 1.6).
  "tackle-shop": "/assets/game/wharf/tackle-shop.glb",
  // The shipwright: the shed (walls x +-1.9, z +-2; doors open to the front and to a side pier along +x over the water,
  // x 2.15 to 3.45, z -2.25 to 0.4) and its boat, a hull half planked with the ribs showing at the bow, a separate model
  // so it can bob. The boat's origin is on the waterline at its middle, the bow to -z; it floats with its origin at
  // (5.4, -1.078, -3.6) in the shed's frame (the sea's level under a deck at 1), same yaw. The gangplank is the shed's:
  // it runs off the pier to (4.3, 0.16, -2) in the shed's frame, just over the boat's gunwale. The boat's not solid.
  ...Object.fromEntries(["shipwright-shed", "shipwright-boat"].map(m => [m, `/assets/game/wharf/${m}.glb`])),
  // More shells for the sand (art/props/build_beach_shells.py), scenery beside the four forage shells, lying on the sand
  // at y 0, not solid, one P_Paint each so they merge: a sea star 0.34 across, a sand dollar 0.22, a conch 0.34 along z.
  ...Object.fromEntries(["starfish", "sand-dollar", "conch"].map(m => [m, `${P}${m}.glb`])),
};
export const propUrl = (model: string) => REMODELLED_PROPS[model] ?? SCENERY_URLS[model] ?? `/assets/acnh/props/${model}.glb`;

/**
 * Interior pieces (interiorShared Piece, by the dump's furniture name) now drawn from our own model. Each is authored at
 * the size the dump piece shows at scale 0.1 (one cell = 1 u), so a Piece keeps its dump scale and draws ours at × 10:
 * every room's layout, footprint and light stays as it was.
 */
export const REMODELLED_PIECES: Readonly<Record<string, string>> = {
  "floor-lamp": `${P}hq-floor-lamp.glb`,
  "clubhouse-pendant": `${P}hq-pendant.glb`,
  "yellow-message-mat": `${P}welcome-mat.glb`,
  "lounge-book": STUDY_BOOK_URL,
  "shopping-cart": SHOP_CART_URL,
  // Not a dump name: the member clubhouse asks for it (the applicant island's clubhouse keeps the dump's "bulletinboard").
  "hq-notice-board": HQ_NOTICE_BOARD_URL,
};
/** What a remodelled piece's model is drawn at, for a dump scale. */
export const REMODELLED_PIECE_SCALE = 10;
/** A piece's own model and its scale at a call site's dump scale, or null while it is still the dump's. */
export function remodelledPiece(name: string, dumpScale: number): { url: string; scale: number } | null {
  const url = REMODELLED_PIECES[name];
  return url ? { url, scale: dumpScale * REMODELLED_PIECE_SCALE } : null;
}
