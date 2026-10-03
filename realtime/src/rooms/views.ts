// Interest management (specs/multiplayer.md §4.4): who receives whose avatar.
// Same area, neither in a private one (ruins, home, house: hidden and blind), and
// in a ranged area (the village) within `radiusIn`, kept until `radiusOut` so a
// player at the edge doesn't flicker. Interiors are small enough to see everyone.
// Nobody receives their own avatar: the client draws it itself.

export type Seen = { key: string; area: number; x: number; z: number };

export type ViewRules = {
  /** Areas where nobody is seen and nobody sees (private). */
  hidden(area: number): boolean;
  /** Areas where distance applies (the village). */
  ranged(area: number): boolean;
  radiusIn: number;
  radiusOut: number;
};

/** Should `viewer` have `other` in view, given whether it has it now? */
export function sees(viewer: Seen, other: Seen, seenNow: boolean, rules: ViewRules): boolean {
  if (viewer.key === other.key) return false;
  if (viewer.area !== other.area) return false;
  if (rules.hidden(viewer.area)) return false;
  if (!rules.ranged(viewer.area)) return true;
  const r = seenNow ? rules.radiusOut : rules.radiusIn;
  const dx = viewer.x - other.x, dz = viewer.z - other.z;
  return dx * dx + dz * dz <= r * r;
}

/**
 * The changes that bring `current` (viewer key → keys in its view) in line with the rules.
 * Pure: the room applies them to each client's StateView.
 */
export function planViews(
  players: readonly Seen[],
  current: ReadonlyMap<string, ReadonlySet<string>>,
  rules: ViewRules,
): { viewer: string; add: string[]; remove: string[] }[] {
  const out: { viewer: string; add: string[]; remove: string[] }[] = [];
  for (const viewer of players) {
    const now = current.get(viewer.key) ?? new Set<string>();
    const add: string[] = [];
    const remove: string[] = [];
    for (const other of players) {
      const has = now.has(other.key);
      const want = sees(viewer, other, has, rules);
      if (want && !has) add.push(other.key);
      else if (!want && has) remove.push(other.key);
    }
    // Keys that left the room entirely.
    for (const k of now) if (!players.some((p) => p.key === k)) remove.push(k);
    if (add.length > 0 || remove.length > 0) out.push({ viewer: viewer.key, add, remove });
  }
  return out;
}
