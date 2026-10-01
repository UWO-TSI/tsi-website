/**
 * The leaf glider unlock (row 245, specs/glider.md): a craft-only tool
 * (lib/crafting/recipes.ts, never sold) whose ownership turns gliding on in the
 * village and on the home island; the ruins and interiors never pass it on.
 */
/** The glider's catalogue_ref in the inventory. */
export const GLIDER_REF = "glider_leaf";
/** Owned gear keys (inventory `catalogue_ref`s, as for the rods) → can this member glide? */
export const ownsGlider = (owned: readonly string[]) => owned.includes(GLIDER_REF);
