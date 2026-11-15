/**
 * The game's tiny event log, browser side (specs/analytics.md). Nothing here runs per frame: events queue in memory and
 * go out in one POST at most every FLUSH_MS, or in one beacon when the page hides. A no-op until startSession() runs
 * (only the member island calls it, so the applicant island's shared components send nothing), and for good after the
 * route says no (signed out, or the table isn't there yet).
 */
import { API_WRITE } from "@/lib/apiClient";
import { featureForPath, isClientStep, type FeatureId, type Screen } from "./steps";

export type EventKind = "session_start" | "heartbeat" | "session_end" | "step" | "feature";
export interface QueuedEvent { kind: EventKind; step?: string; screen?: Screen; ago: number }

const ROUTE = "/api/analytics/events";
const FLUSH_MS = 15_000;
export const HEARTBEAT_MS = 3 * 60_000;

let session: string | null = null;
let off = false;
let screen: Screen = "village";
let queue: { kind: EventKind; step?: string; screen?: Screen; t: number }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const sent = new Set<string>();

function body(now: number) {
  const events: QueuedEvent[] = queue.map(({ t, ...e }) => ({ ...e, ago: Math.max(0, Math.round(now - t)) }));
  queue = [];
  return JSON.stringify({ session, events });
}

function flush(beacon = false): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (off || !session || !queue.length) return;
  const json = body(Date.now());
  if (beacon && navigator.sendBeacon?.(ROUTE, new Blob([json], { type: "application/json" }))) return;
  fetch(ROUTE, { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true })
    .then((r) => { if (r.status === 401 || r.status === 403 || r.status === 503) off = true; })
    .catch(() => {});
}

function push(kind: EventKind, step?: string): void {
  if (off || !session) return;
  queue.push({ kind, step, screen, t: Date.now() });
  if (queue.length >= 20) flush();
  else timer ??= setTimeout(flush, FLUSH_MS);
}

/** A step of the funnel reached (once per session; the dashboard keeps each player's first). Ids not in the list drop. */
export function trackStep(step: string): void {
  if (!isClientStep(step) || sent.has(step)) return;
  sent.add(step);
  push("step", step);
}

/** A feature used (once per session). Most come from the writes routes announce; catches post on their own. */
export function trackFeature(f: FeatureId): void {
  if (sent.has(`f:${f}`)) return;
  sent.add(`f:${f}`);
  push("feature", f);
}

/** Where the player is now: the last screen before a session ends is the "where they quit" answer. */
export function setScreen(next: Screen): void { screen = next; }

/** The member island mounted: start the session, the heartbeat while the tab shows, the end on pagehide, and a
 * feature's first use per session from the writes the routes already announce. Returns the stop. */
export function startSession(): () => void {
  if (session || typeof window === "undefined") return () => {};
  session = globalThis.crypto?.randomUUID?.() ?? null;
  if (!session) return () => {};
  push("session_start");
  const beat = setInterval(() => { if (document.visibilityState === "visible") { push("heartbeat"); flush(); } }, HEARTBEAT_MS);
  const hide = () => { push("session_end"); flush(true); };
  const hidden = () => { if (document.visibilityState === "hidden") flush(true); };
  const wrote = (e: Event) => {
    const f = featureForPath((e as CustomEvent<{ path?: string }>).detail?.path ?? "");
    if (f) trackFeature(f);
  };
  window.addEventListener("pagehide", hide);
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener(API_WRITE, wrote);
  return () => {
    clearInterval(beat);
    window.removeEventListener("pagehide", hide);
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener(API_WRITE, wrote);
    hide();
    session = null;
    sent.clear();
  };
}
