"use client";

/**
 * This account's arrival flag on the client (the opening plays once per account; app/api/world/arrival). Signed out
 * there is no account: null. A flag that can't be read counts as arrived, so a hiccup never replays the opening.
 */
import { useEffect, useState } from "react";

export function useArrivalFlag(signedIn: boolean): { arrived: boolean | null; markArrived: () => void } {
  const [arrived, setArrived] = useState<boolean | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/world/arrival").then(r => (r.ok ? r.json() : null)).then((b: { arrived?: boolean } | null) => {
      if (alive) setArrived(typeof b?.arrived === "boolean" ? b.arrived : true);
    }).catch(() => { if (alive) setArrived(true); });
    return () => { alive = false; };
  }, [signedIn]);
  return { arrived: signedIn ? arrived : null, markArrived: () => setArrived(true) };
}

/** Arrived: the reward (once per account) and the flag. Resolves to the new coin balance, or null (signed out, offline, already paid). */
export async function postArrival(): Promise<{ balance: number; coins: number } | null> {
  try {
    const r = await fetch("/api/world/arrival", { method: "POST" });
    const b = r.ok ? await r.json() as { arrival?: { balance: number; coins: number; granted: boolean } } : null;
    return b?.arrival?.granted ? { balance: b.arrival.balance, coins: b.arrival.coins } : null;
  } catch { return null; }
}
