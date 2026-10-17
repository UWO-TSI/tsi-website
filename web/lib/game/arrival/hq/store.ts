/**
 * The HQ visit and the tool quests on this client (row 312): whether this account's tools are taught (the arrival
 * flag says so, app/api/world/arrival), where the visit with Wren is (visit.ts), and each tool's little quest
 * (teachers.ts). The visit and the quests are kept on this device, like the moves a Keeper teaches
 * (lib/game/moveUnlocks.ts); a tool's ownership is the server's (POST /api/world/tools puts it in the inventory).
 * React reads one snapshot (useHq); everything that changes it goes through here.
 */
import { useSyncExternalStore } from "react";
import { newVisit, parseVisit, visitEvent, type HqState } from "./visit";
import { parseQuests, type TaughtTool, type ToolQuests } from "./teachers";
import type { HqEvent } from "./script";

const VISIT_KEY = "tsi.hq.v1";
const QUESTS_KEY = "tsi.toolQuests.v1";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
const local = (): Store => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };
const read = (s: Store, key: string): unknown => { try { return JSON.parse(s?.getItem(key) ?? "null"); } catch { return null; } };
const write = (s: Store, key: string, v: unknown) => { try { if (v === null) s?.removeItem(key); else s?.setItem(key, JSON.stringify(v)); } catch { /* this session only */ } };

export interface HqSnapshot {
  /** This account's tools are taught by people (it arrived under row 312), or a dev preview says so. */
  taught: boolean;
  /** The visit with Wren: null when there's none (never started, or an account from before row 312). */
  visit: HqState | null;
  quests: ToolQuests;
}
const EMPTY: HqSnapshot = { taught: false, visit: null, quests: {} };
let snap: HqSnapshot | null = null;
const listeners = new Set<() => void>();
function current(): HqSnapshot {
  if (!snap) {
    const s = local();
    snap = typeof window === "undefined" ? EMPTY : { taught: false, visit: parseVisit(read(s, VISIT_KEY)), quests: parseQuests(read(s, QUESTS_KEY)) };
  }
  return snap;
}
function set(next: Partial<HqSnapshot>) {
  const was = current();
  snap = { ...was, ...next };
  if (next.visit !== undefined && next.visit !== was.visit) write(local(), VISIT_KEY, next.visit && { beat: next.visit.beat, done: next.visit.done });
  if (next.quests !== undefined && next.quests !== was.quests) write(local(), QUESTS_KEY, next.quests);
  listeners.forEach(l => l());
}
export const hqSnapshot = () => current();
export function subscribeHq(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useHq(): HqSnapshot { return useSyncExternalStore(subscribeHq, hqSnapshot, () => EMPTY); }

/** The arrival flag said (or a dev preview): this account's tools are taught, or not. */
export function setToolsTaught(taught: boolean) { if (current().taught !== taught) set({ taught }); }

/** Bram's tour is over for a new arrival: the visit with Wren starts (its first step: report to her at HQ). */
export function startVisit() { set({ visit: newVisit() }); }

/** Something the visit waits for happened (or her lines were said). Nothing changes unless the beat moves on. */
export function hqEvent(e: HqEvent | "said") {
  const v = current().visit;
  if (!v) return;
  const next = visitEvent(v, e);
  if (next !== v) set({ visit: next });
}

/**
 * A resident handed you their tool: its quest runs, it's on the wheel at once, and the server puts it in your
 * inventory. Asked again (talking to them while the quest runs) it only asks the server again: a grant that failed
 * (offline) gets another go; the server's grant is once per member whatever is asked.
 */
export function giveTool(tool: TaughtTool) {
  const q = current().quests;
  if (!q[tool]) set({ quests: { ...q, [tool]: "given" } });
  void postTool(tool);
}
/** Its quest is done: the tool is yours (it already is, server side). */
export function finishToolQuest(tool: TaughtTool) {
  const q = current().quests;
  if (q[tool] === "given") set({ quests: { ...q, [tool]: "done" } });
}

async function postTool(tool: TaughtTool): Promise<boolean> {
  try {
    const r = await fetch("/api/world/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool }) });
    if (r.ok) window.dispatchEvent(new CustomEvent("tsi:tools-changed"));
    return r.ok;
  } catch { return false; }
}

/** Tests and dev only: forget everything (the next read comes from storage again). */
export function resetHqStore() { snap = null; listeners.forEach(l => l()); }
