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
/** The sushi bar (game/sushi-bar), and its lanterns, string lights, neon and tank water, which glow at night like a lamp's glass. */
export const SUSHI_BAR_URL = "/assets/game/buildings/sushi-bar.glb";
export const SUSHI_BAR_GLOW_URL = "/assets/game/buildings/sushi-bar-glow.glb";
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
  // Its forest masses (art/trees/build_forest_masses.py, remodelled by game/village-art): a stand of trees that each grow
  // their own way (cedars, firs, broadleaf, young trees, a snag) in one mesh, about 12 (a), 16 by 9 along x (b), 10 (c),
  // a 14 by 8 kidney (d) and 18 by 13 (e) across, to instance over the closed forest so it reads dense from the open
  // area. Each runs 2.2 below its origin (trunks and a plug of floor): set it at the lowest ground under its footprint.
  ...Object.fromEntries(["a", "b", "c", "d", "e"].map(m => [`forest-mass-${m}`, `/assets/game/plants/forest-mass-${m}.glb`])),
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
  // game/village-art: the path's edges (art/props/build_path_edge.py): mossy side rocks (scale them freely), and the loose
  // fence in short runs along x (leave gaps between runs; the lone post fills one); and a meadow patch of wild flowers in
  // grass and a clump of tall grass (art/trees/build_flowers.py, a tile across at scale 1).
  ...Object.fromEntries(["path-rock-slab", "path-rock-low", "path-rock-cluster", "rustic-fence-a", "rustic-fence-b", "rustic-post"].map(m => [m, `${P}${m}.glb`])),
  ...Object.fromEntries(["meadow", "tallgrass"].map(m => [`flower-${m}`, `/assets/game/plants/flower-${m}.glb`])),
  // game/wharf-art: the beach set (art/props/build_beach_set.py), the origin on the ground: a lifeguard tower (its ladder
  // to +z), surfboards stuck in the sand, and coral clumps for the shallows (their foot on the seabed, not solid).
  "lifeguard-tower": `${P}lifeguard-tower.glb`,
  // game/sushi-bar: the sushi bar (art/buildings/build_sushi_bar.py), a long open bar about 9.2 by 6.1, the origin at the
  // middle of its solid kitchen core (x ±4, z ±1.5), the guests' deck and six stools toward +z, the open window onto the
  // sea toward -z. What glows is its own model (SUSHI_BAR_GLOW_URL), drawn by components/game/SushiBar.tsx.
  "sushi-bar": SUSHI_BAR_URL,
  // The fish market (art/buildings/build_fish_market.py): a red board house 5 by 3.6, its front to +z, a marlin on the ridge,
  // an awning out to z 2.75 over a table of fish; an exterior only, the origin at the middle of its floor.
  "fish-market": "/assets/game/buildings/fish-market.glb",
  ...Object.fromEntries(["a", "b", "c"].map(m => [`surfboard-${m}`, `${P}surfboard-${m}.glb`])),
  ...Object.fromEntries(["a", "b", "c", "d"].map(m => [`coral-${m}`, `/assets/game/water/coral-${m}.glb`])),
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
