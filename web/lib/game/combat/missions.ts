/**
 * Mission tracking on the island over the systems state machines
 * (web/lib/combat/missions.ts applyEvent). Events get ids so the server
 * applies each once; the island keeps the queue to post to
 * /api/combat/missions/progress and a line for the tracker.
 */
import { MISSIONS as SYSTEM_MISSIONS } from "@/lib/combat/content";
import { applyEvent, initialProgress, type MissionEvent as SystemEvent, type MissionProgress } from "@/lib/combat/missions";
import type { MissionDef } from "./contract";
import { FETCH_SPOTS } from "@/lib/game/ruins";
import { ROSTER } from "@/lib/collections/roster";
import { MATERIALS } from "@/lib/crafting/recipes";

const NAMES = new Map([...ROSTER, ...MATERIALS].map(s => [s.key, s.name]));
/** "Crystal ×2, Gold Nugget ×1" for mission and boss rewards. */
export const materialsLabel = (items: Record<string, number>) => Object.entries(items).map(([k, n]) => `${NAMES.get(k) ?? k} ×${n}`).join(", ");

export type MissionEvent =
  | { kind: "kill"; enemy: string }
  | { kind: "pickup"; item: string }
  | { kind: "return" }
  | { kind: "wave-cleared"; wave: number }
  | { kind: "checkpoint"; n: number }
  | { kind: "arrived" }
  | { kind: "escort-down" }
  | { kind: "defeated" };

export interface MissionState {
  def: MissionDef; progress: MissionProgress;
  /** Server progress row once /api/combat/missions/start answered (null: local only). */
  progressId: string | null;
  queue: SystemEvent[]; seq: number;
  status: "active" | "complete" | "failed";
  goal: number; note: string; rewarded: boolean;
}

const systemDef = (id: string) => SYSTEM_MISSIONS.find(m => m.key === id)!;

export function startMission(def: MissionDef, progressId: string | null = null): MissionState {
  const goal = def.params.count ?? def.params.waves ?? 1;
  return withNote({ def, progress: initialProgress(), progressId, queue: [], seq: 0, status: "active", goal, note: "", rewarded: false });
}

function toSystem(ev: MissionEvent, id: string): SystemEvent {
  switch (ev.kind) {
    case "kill": return { id, type: "kill", enemy: ev.enemy };
    case "pickup": return { id, type: "pickup", item: ev.item };
    case "return": return { id, type: "return" };
    case "wave-cleared": return { id, type: "wave_cleared", wave: ev.wave };
    case "checkpoint": return { id, type: "checkpoint", n: ev.n };
    case "arrived": return { id, type: "arrived" };
    case "escort-down": return { id, type: "escort_down" };
    case "defeated": return { id, type: "defeat" };
  }
}

const plural = (w: string) => (/(x|s|ch|sh)$/.test(w) ? `${w}es` : `${w}s`);

function withNote(s: MissionState): MissionState {
  const p = s.progress, t = s.def.template;
  const status = p.state === "ready" || p.state === "completed" ? "complete" : p.state === "failed" || p.state === "abandoned" ? "failed" : "active";
  const note = status === "complete" ? "Done. Claim it at the board."
    : status === "failed" ? (t === "escort" ? "The escort turned back." : t === "survive" ? "The waves pushed you out." : "Mission failed.")
    : t === "hunt" ? `${p.counter} / ${s.goal} ${plural(s.def.params.enemy?.replace(/-/g, " ") ?? "")}`
    : t === "fetch" ? (p.carrying ? "Bring it back to the gate" : FETCH_SPOTS[s.def.params.item ?? ""]?.hint ?? "Find it in the ruins")
    : t === "survive" ? (p.counter ? `Wave ${Math.min(p.counter + 1, s.goal)} of ${s.goal}` : "Step into the rune circle")
    : `Checkpoint ${p.counter} of ${s.goal}. Stay close`;
  return { ...s, status, note };
}

export function advanceMission(s: MissionState, ev: MissionEvent): MissionState {
  if (s.status !== "active") return s;
  const sys = toSystem(ev, `${s.def.id}:${s.seq + 1}:${ev.kind}`);
  const progress = applyEvent(systemDef(s.def.id), s.progress, sys);
  if (progress === s.progress) return s;
  return withNote({ ...s, progress, seq: s.seq + 1, queue: [...s.queue, sys] });
}
