/**
 * Furniture recolor pipeline (collab track, 2026-07-25).
 *
 * A Tint maps material-name substrings → hex, applied at clone time in
 * interiorShared's Piece. Tints multiply existing albedo textures.
 * HQ furniture's missing remake atlases and UVs were restored from the
 * original assets on 2026-09-17; use those instead of flat-color substitutes.
 *
 * Workflow with David (documented in specs/collab-design-track.md):
 *  1. Open /lab/furniture?piece=<name> — the material inspector lists the
 *     GLB's material slot names.
 *  2. David names hexes per slot (or one "*" catch-all), or picks a PRESET.
 *  3. The ruling lands here in PIECE_TINTS — every room using the piece
 *     picks it up automatically.
 */

export type Tint = Record<string, string>;

/** Named starter palettes — ACNH-warm, for quick rulings. */
export const PRESETS: Record<string, Tint> = {
  oak: { "*": "#B98A5C" },
  walnut: { "*": "#7A5A3E" },
  driftwood: { "*": "#A08B6E" },
  cream: { "*": "#EFE6D2" },
  sage: { "*": "#9BB08A" },
  terracotta: { "*": "#C97E5A" },
  navy: { "*": "#3E5C7A" },
};

/**
 * Per-piece rulings (David is the taste layer — entries land here after a
 * /lab/furniture session). Keys are furniture GLB basenames.
 */
export const PIECE_TINTS: Record<string, Tint> = {
  // Wharf barrels: oiled-oak demo ruling (pending David's pass). Note the
  // counter-register carries NO tint — it ships textured, and tints
  // MULTIPLY over textures (mid-tone hexes go muddy). The restored HQ
  // furniture likewise keeps its original textured colors without a tint.
  barrel: { "*": "#B08A5E" },
};
