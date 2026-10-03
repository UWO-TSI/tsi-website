"use client";

/**
 * Class auras on the other players (specs/multiplayer.md §5.6): the subclass aura (its kit at its mastery, the
 * equipped colour) or, before a subclass, the family's motes, drawn round each remote's own feet. Only for players who
 * show their class (their FLAG.showClass), at most 8, the nearest Full ones (lod.ts). The driver updates the set at
 * each re-tier; React mounts and unmounts auras only when it changes.
 */
import { Suspense, useSyncExternalStore } from "react";
import type * as THREE from "three";
import FamilyAura from "../oracle/FamilyAura";
import SubclassAura from "../oracle/SubclassAura";
import { classKit, type ClassKit } from "@/lib/combat/classes";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { RemotePlayer } from "@/lib/net/types";
import type { RemoteRig } from "./drive";

/** The aura a player's card asks for: their subclass kit's, else their family's, else none; only when they show their class. */
export function auraOf(p: RemotePlayer): { kit: ClassKit; mastery: number; colour: string | null } | { family: string } | null {
  if (!p.showClass) return null;
  const kit = classKit(p.kit);
  if (kit) return { kit, mastery: p.mastery, colour: p.aura === "mastery:colour" ? kit.look.ramp[0] : null };
  return p.family ? { family: FAMILIES[p.family].light } : null;
}

/** Whether a player shows an aura at all (the re-tier asks for everyone in view). */
export const showsAura = (p: RemotePlayer) => p.showClass && (!!p.family || !!classKit(p.kit));

export interface AuraView { sid: number; feet: { current: THREE.Vector3 }; player: RemotePlayer }

/** The auras shown, as React's snapshot: replaced only when who has one (or their card) changes. */
export class AuraStore {
  list: readonly AuraView[] = [];
  private readonly listeners = new Set<() => void>();
  /** From the rigs after a re-tier (their `lod.aura`). */
  update(rigs: readonly RemoteRig[]) {
    let k = 0, same = true;
    for (let i = 0; i < rigs.length && same; i++) {
      const r = rigs[i];
      if (!r.lod.aura) continue;
      const a = this.list[k++];
      same = !!a && a.sid === r.sid && a.player === r.entry.player;
    }
    if (same && k === this.list.length) return;
    this.list = rigs.filter(r => r.lod.aura).map(r => ({ sid: r.sid, feet: r.feet, player: r.entry.player }));
    for (const l of this.listeners) l();
  }
  readonly subscribe = (l: () => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  readonly snapshot = () => this.list;
}

function Aura({ view }: { view: AuraView }) {
  const a = auraOf(view.player);
  if (!a) return null;
  return "kit" in a ? <SubclassAura player={view.feet} kit={a.kit} mastery={a.mastery} colour={a.colour} /> : <FamilyAura player={view.feet} color={a.family} />;
}

export default function RemoteAuras({ store }: { store: AuraStore }) {
  const list = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return <>{list.map(v => <Suspense key={v.sid} fallback={null}><Aura view={v} /></Suspense>)}</>;
}
