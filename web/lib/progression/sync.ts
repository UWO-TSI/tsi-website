/**
 * Throttled real-activity sync: reads of goal progress credit any new QR
 * check-ins / completed bounties at most once a minute per goal per server
 * instance. Deterministic keys make overlapping runs harmless.
 */
import { syncRealActivity } from "./service";
import type { ProgressionStore } from "./store";

const SYNC_INTERVAL_MS = 60_000;
const lastSync = new Map<string, number>();

export async function syncGoalsThrottled(store: ProgressionStore, now: Date, force = false): Promise<{ credited: number; skipped: number }> {
  const goals = await store.listGoals();
  let credited = 0;
  let skipped = 0;
  for (const goal of goals) {
    const last = lastSync.get(goal.id) ?? 0;
    if (!force && now.getTime() - last < SYNC_INTERVAL_MS) continue;
    lastSync.set(goal.id, now.getTime());
    const r = await syncRealActivity(store, goal, now);
    credited += r.credited;
    skipped += r.skipped;
  }
  return { credited, skipped };
}
