/**
 * The remotes in view as rigs (drive.ts), kept in step with the source's registry: a rig when someone comes into
 * view, gone when they leave, and a new list for React when someone comes, goes or changes card or slow state, never
 * for motion. The frame loop looks rigs up by `sid` (a Map get, nothing allocated).
 */
import type { RemoteChange, RemoteEntry, RemoteRegistry } from "@/lib/net/types";
import { createRig, type RemoteRig } from "./drive";

export class RigStore {
  readonly map = new Map<number, RemoteRig>();
  /** React's snapshot: the rigs by sid, replaced on every add, remove or change. */
  list: readonly RemoteRig[] = [];
  /** Someone came into view since the driver last looked: it re-tiers at once rather than within a quarter second. */
  arrived = false;
  private readonly listeners = new Set<() => void>();
  private off: (() => void) | null = null;

  constructor(private readonly reg: RemoteRegistry) {}

  /** Start following the registry (with whoever is in view already); returns the stop. */
  attach(): () => void {
    for (let i = 0; i < this.reg.size; i++) this.add(this.reg.at(i));
    this.rebuild();
    this.off = this.reg.subscribe(this.onChange);
    return () => { this.off?.(); this.off = null; this.map.clear(); this.list = []; };
  }

  private add(e: RemoteEntry) {
    const had = this.map.get(e.sid);
    if (had && had.entry === e) return;
    this.map.set(e.sid, createRig(e));
    this.arrived = true;
  }
  private readonly onChange = (change: RemoteChange, e: RemoteEntry) => {
    if (change === "add") this.add(e);
    else if (change === "remove") this.map.delete(e.sid);
    else { const r = this.map.get(e.sid); if (r) r.entry = e; else this.add(e); }
    this.rebuild();
  };
  private rebuild() {
    this.list = [...this.map.values()].sort((a, b) => a.sid - b.sid);
    for (const l of this.listeners) l();
  }

  readonly subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  readonly snapshot = () => this.list;
}
