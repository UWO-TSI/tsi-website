/**
 * A casual win's coins (specs/minigames/beach-volleyball.md, "Match and rewards"): the server opens a ticket when a
 * match starts on the island and decides the payout when it ends (/api/volleyball/start, /finish; the checks are in
 * the 20261030120000_volleyball_casual migration). Nothing here is trusted: the client only names its ticket and the
 * score. Signed out, in the lab, or offline, both are quiet no-ops.
 */
import { apiCall } from "@/lib/apiClient";

let ticket: string | null = null;
const quiet = (e: unknown) => { if (process.env.NODE_ENV !== "production") console.debug("[volleyball reward]", e); return null; };

/** A match starts on the island: open its ticket (a newer one closes any older one, server side). */
export async function beginTicket(): Promise<void> {
  ticket = null;
  const t = await apiCall<{ id: string; seed: number }>("/api/volleyball/start", "ticket", {}).catch(quiet);
  ticket = t?.id ?? null;
}

/** The match ended, `points` [home (yours), away]: the server's answer, once per ticket; null without a ticket. */
export async function claimWin(points: readonly [number, number]): Promise<{ paid: number; capped: boolean } | null> {
  const id = ticket;
  if (!id) return null;
  ticket = null;
  const r = await apiCall<{ status: string; paid: number }>("/api/volleyball/finish", "result", { ticket: id, points: [points[0], points[1]] }).catch(quiet);
  return r ? { paid: r.paid, capped: r.status === "capped" } : null;
}
