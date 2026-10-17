"use client";

/**
 * This account's arrival flag on the client (the opening plays once per account; app/api/world/arrival). Signed out
 * there is no account: null. A flag that can't be read counts as arrived, so a hiccup never replays the opening.
 */
import { useEffect, useState } from "react";
import { setToolsTaught } from "./hq/store";

/** The flag, and (row 312) whether the account's tools are taught by people: told to the HQ store as it loads. */
export function useArrivalFlag(signedIn: boolean): { arrived: boolean | null; markArrived: () => void } {
  const [arrived, setArrived] = useState<boolean | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    fetch("/api/world/arrival").then(r => (r.ok ? r.json() : null)).then((b: { arrived?: boolean; taught?: boolean } | null) => {
      if (!alive) return;
      setArrived(typeof b?.arrived === "boolean" ? b.arrived : true);
      if (b?.taught === true) setToolsTaught(true);
    }).catch(() => { if (alive) setArrived(true); });
    return () => { alive = false; };
  }, [signedIn]);
  return { arrived: signedIn ? arrived : null, markArrived: () => setArrived(true) };
}

/**
 * Arrived: the reward (once per account) and the flag. Resolves to what the server said: the coins paid (none when
 * already paid) and whether the account's tools are taught (row 312); null signed out or offline.
 */
export async function postArrival(): Promise<{ balance: number; coins: number; granted: boolean; taught: boolean } | null> {
  try {
    const r = await fetch("/api/world/arrival", { method: "POST" });
    const b = r.ok ? await r.json() as { arrival?: { balance: number; coins: number; granted: boolean; taught?: boolean } } : null;
    return b?.arrival ? { balance: b.arrival.balance, coins: b.arrival.coins, granted: b.arrival.granted, taught: b.arrival.taught === true } : null;
  } catch { return null; }
}
