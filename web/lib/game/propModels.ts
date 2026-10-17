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
 * The plaza's notice and catch boards (and the mission board, GENESIS's poster board), in the dump board's frame: the
 * origin at the board's left end on the ground, the board 1.68 along +x, its cork facing +z. `back` is the backing's
 * back face (z) and `cork` its cork face [x0, x1, y0, y1] (art/props/build_plaza_boards.py).
 */
export const NOTICE_BOARD_URL = `${P}notice-board.glb`;
export const CATCH_BOARD_URL = `${P}catch-board.glb`;
export const PLAZA_BOARD = { back: 0.37, cork: [0.17, 1.51, 0.57, 1.41] as const };
/** The log bench: its seat top at 0.51 inside the old bench's footprint (defaultIsland PROP_TOP, PROP_FOOTPRINT "bench-wood"). */
export const LOG_BENCH_URL = `${P}log-bench.glb`;

/**
 * The plank footbridge (the map's bridges, the editor's, GENESIS's stage deck), in the dump bridge's frame: spanning
 * x ±1.9, its rails along z ±1.33 (inside defaultIsland's rail strips), the deck's top at BRIDGE_DECK_TOP.
 */
export const BRIDGE_URL = `${P}bridge-plank.glb`;
export const BRIDGE_DECK_TOP = 0.075;
/** The canvas parasol over two deck chairs by the pier table (and the homes' Parasol): the pole's foot at the origin. */
export const BEACH_PARASOL_URL = `${P}beach-parasol.glb`;
/** The member clubhouse's notice board (HQInterior `noticeBoard`), a remodelled piece by its own name (below). */
export const HQ_NOTICE_BOARD_URL = `${P}hq-notice-board.glb`;
/** The shop's trolley: a timber handcart with a wicker basket, the remodelled "shopping-cart" piece (below). */
export const SHOP_CART_URL = `${P}shop-cart.glb`;

/** Map props by the model the map stores (`bench-wood`): ours where remodelled, else the dump's. */
export const REMODELLED_PROPS: Readonly<Record<string, string>> = { "bench-wood": LOG_BENCH_URL };
export const propUrl = (model: string) => REMODELLED_PROPS[model] ?? `/assets/acnh/props/${model}.glb`;

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
