/**
 * Mission state machines for the four templates (row 231). Events carry an
 * id; an event already seen is ignored, so client retries never double-count.
 *
 *   active ──(objectives met)──▶ ready ──complete──▶ completed
 *      │                          │
 *      └──(fail rule)──▶ failed   └── (abandon) ──▶ abandoned
 *
 * hunt:    kill events of the target enemy count up to N.
 * fetch:   pickup the item, then return to the gate; defeat drops the item.
 * survive: wave_cleared 1..N in order; defeat fails.
 * escort:  checkpoints 1..N in order, then arrived; the resident going down fails.
 */
import type { MissionDef } from "./content";

export type MissionState = "active" | "ready" | "completed" | "failed" | "abandoned";
export interface MissionProgress {
  state: MissionState;
  counter: number; // kills / waves / checkpoints
  carrying: boolean; // fetch
  seen: string[]; // processed event ids
}
export type MissionEvent =
  | { id: string; type: "kill"; enemy: string }
  | { id: string; type: "pickup"; item: string }
  | { id: string; type: "return" }
  | { id: string; type: "wave_cleared"; wave: number }
  | { id: string; type: "checkpoint"; n: number }
  | { id: string; type: "arrived" }
  | { id: string; type: "escort_down" }
  | { id: string; type: "defeat" }
  | { id: string; type: "abandon" };

export const initialProgress = (): MissionProgress => ({ state: "active", counter: 0, carrying: false, seen: [] });

export const MAX_SEEN = 500;

export function applyEvent(def: MissionDef, p: MissionProgress, ev: MissionEvent): MissionProgress {
  if (p.state !== "active" && !(p.state === "ready" && ev.type === "abandon")) return p;
  if (p.seen.includes(ev.id)) return p;
  const n: MissionProgress = { ...p, seen: [...p.seen, ev.id].slice(-MAX_SEEN) };
  if (ev.type === "abandon") return { ...n, state: "abandoned" };
  const count = Number(def.params.count ?? def.params.waves ?? def.params.checkpoints ?? 0);
  switch (def.template) {
    case "hunt":
      if (ev.type === "kill" && ev.enemy === def.params.enemy) {
        n.counter = Math.min(count, n.counter + 1);
        if (n.counter >= count) n.state = "ready";
      }
      return n;
    case "fetch":
      if (ev.type === "pickup" && ev.item === def.params.item) n.carrying = true;
      if (ev.type === "defeat") n.carrying = false; // woke at the gate without it
      if (ev.type === "return" && n.carrying) n.state = "ready";
      return n;
    case "survive":
      if (ev.type === "defeat") return { ...n, state: "failed" };
      if (ev.type === "wave_cleared" && ev.wave === n.counter + 1) {
        n.counter = ev.wave;
        if (n.counter >= count) n.state = "ready";
      }
      return n;
    case "escort":
      if (ev.type === "escort_down" || ev.type === "defeat") return { ...n, state: "failed" };
      if (ev.type === "checkpoint" && ev.n === n.counter + 1) n.counter = ev.n;
      if (ev.type === "arrived" && n.counter >= count) n.state = "ready";
      return n;
  }
}

export function applyEvents(def: MissionDef, p: MissionProgress, events: MissionEvent[]): MissionProgress {
  return events.reduce((acc, ev) => applyEvent(def, acc, ev), p);
}

/** Repeatable after the cooldown since the last completion. */
export function canStart(def: MissionDef, lastCompletedAt: string | null, hasActive: boolean, now: Date): { ok: true } | { ok: false; reason: "active" | "cooldown"; until?: string } {
  if (hasActive) return { ok: false, reason: "active" };
  if (!lastCompletedAt) return { ok: true };
  const until = Date.parse(lastCompletedAt) + def.cooldown_hours * 3_600_000;
  return now.getTime() >= until ? { ok: true } : { ok: false, reason: "cooldown", until: new Date(until).toISOString() };
}
