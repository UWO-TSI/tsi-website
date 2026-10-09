/** Event check-in: the QR's link, and what the check-in page makes of POST /api/events/:id/check-in. */
import { PLAY_ORIGIN } from "@/lib/hosts";

/**
 * The portal the printed QR codes point at (they outlive any deploy, so never a preview host). Codes printed
 * before the portal moved to play.tethos.ca point at www, which sends /student/check-in across (lib/hosts.ts).
 */
export const CHECK_IN_ORIGIN = PLAY_ORIGIN;

export const checkInPath = (eventId: string, code: string) =>
  `/student/check-in?event=${encodeURIComponent(eventId)}&code=${encodeURIComponent(code)}`;
export const checkInUrl = (eventId: string, code: string) => `${CHECK_IN_ORIGIN}${checkInPath(eventId, code)}`;

export type CheckInResult =
  | { kind: "done"; title: string; irl: boolean; already: boolean }
  | { kind: "signed-out" }
  | { kind: "refused"; message: string }
  | { kind: "error" };

/** Check in: done (or already done), signed out, refused with the route's reason, or an error worth retrying. */
export async function checkIn(eventId: string, code: string, post: typeof fetch = fetch): Promise<CheckInResult> {
  try {
    const res = await post(`/api/events/${encodeURIComponent(eventId)}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) return { kind: "done", title: String(body.event?.title ?? "the event"), irl: body.event?.is_irl === true, already: body.already === true };
    if (res.status === 401) return { kind: "signed-out" };
    if (res.status >= 400 && res.status < 500 && typeof body?.error === "string") return { kind: "refused", message: body.error };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
