"use client";

/**
 * Halloween's island layer (the traditions calendar, lib/content/traditions.ts; lib/game/halloween.ts): the pumpkin
 * lanterns by the lamps, doors and anchors, the fog nights' low mist, and trick-or-treat at the residents' doors. An
 * event overlay: placed from the map's own objects while the tradition runs, gone when it ends, nothing saved.
 *
 * Performance (specs/perf/README.md): the pumpkins are one instanced mesh per material (4 draws however many stand),
 * their carved faces an emissive eased up after dark, never a light; the mist is the fog-day banks' few sprites.
 */
import { Suspense, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
import { addContact, modelContact } from "./ContactShadows";
import { MistBanks } from "./AmbienceFX";
import { FOG_NIGHT, PUMPKIN_URL, knockDoors, nextAnswer, pumpkinSpots, type DoorResident, type KnockDoor, type PumpkinSpot } from "@/lib/game/halloween";
import { windowLit, type IslandLight } from "@/lib/game/islandLighting";
import { worldWind } from "@/lib/game/worldFx";
import type { IslandWeather } from "@/lib/game/islandWeather";
import type { Village } from "@/lib/game/villageMap";
import type { VillageIsland } from "@/lib/game/defaultIsland";
import type { TraditionContent } from "@/lib/content/traditions";
import { nightKey } from "@/lib/content/traditions";
import { worldNow } from "@/lib/game/worldClock";
import { TREATS } from "@/lib/collections/treats";
import { apiCall, ApiError } from "@/lib/apiClient";
import { AudioManager } from "@/lib/game/audio";
import { toast } from "./ToastHub";

useGLTF.preload(PUMPKIN_URL);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** Module scope (the react compiler forbids writing through hook values): ease the carved faces' glow. */
function easeGlow(materials: readonly THREE.MeshStandardMaterial[], target: number, dt: number) {
  for (const m of materials) m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, target, 2, dt);
}

/** The pumpkins: one InstancedMesh per sub-mesh; the carved face (M_PumpkinGlow) eases up with the porch-light curve. */
function PumpkinLanterns({ spots, ground, light }: { spots: readonly PumpkinSpot[]; ground: (x: number, z: number) => number; light: IslandLight }) {
  const { scene } = useGLTF(PUMPKIN_URL);
  const world = useThree(s => s.scene);
  const cls = shadowClassFor(PUMPKIN_URL);
  const model = useMemo(() => prepareModel(scene, PUMPKIN_URL, undefined, cls), [scene, cls]);
  useEffect(() => { applyModelTextures(model, PUMPKIN_URL); return () => disposeModelMaterials(model); }, [model]);
  const matrices = useMemo(() => spots.map(p => _m.compose(_p.set(p.x, ground(p.x, p.z), p.z), _q.setFromAxisAngle(_up, p.yaw), _s.setScalar(p.scale)).clone()), [spots, ground]);
  const { meshes, glow } = useMemo(() => {
    const out: THREE.InstancedMesh[] = [], lit: THREE.MeshStandardMaterial[] = [];
    model.traverse(child => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || !matrices.length) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, matrices.length);
      matrices.forEach((mx, i) => im.setMatrixAt(i, mx));
      Object.assign(im, { name: m.name, castShadow: m.castShadow, receiveShadow: m.receiveShadow, visible: m.visible, frustumCulled: false });
      out.push(im);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat instanceof THREE.MeshStandardMaterial && mat.name === "M_PumpkinGlow") lit.push(mat);
    });
    return { meshes: out, glow: lit };
  }, [model, matrices]);
  useEffect(() => () => meshes.forEach(m => m.dispose()), [meshes]);
  const contact = useMemo(() => modelContact(model, PUMPKIN_URL, cls), [model, cls]);
  const anchors = useMemo(() => matrices.map(mx => { const o = new THREE.Object3D(); o.matrixAutoUpdate = false; o.matrix.copy(mx); return o; }), [matrices]);
  useEffect(() => {
    if (!contact) return;
    const removals = anchors.map(a => addContact(world, a, contact));
    return () => removals.forEach(r => r());
  }, [world, anchors, contact]);
  // Dim by day (a candle in daylight), bright after dark: the porch-light curve the windows follow.
  useFrame((_, raw) => {
    const target = 0.25 + 2.4 * windowLit(light), dt = Math.min(raw, 0.1);
    easeGlow(glow, target, dt);
  });
  return <>
    {meshes.map((m, i) => <primitive key={i} object={m} />)}
    {anchors.map((a, i) => <primitive key={`c${i}`} object={a} />)}
  </>;
}

// ── Trick-or-treat ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The doors and tonight's answers, for the island's prompt (DefaultIslandWorld reads `knockNear` each frame). `on`:
 * trick-or-treat runs and it's night. `treated`: residents who've answered you tonight (the server's, or this
 * device's in development without a database).
 */
export const knockStore = { on: false, doors: [] as KnockDoor[], treated: new Set<string>(), night: "", busy: false, local: false };
/** The door in reach (by its pumpkin) with someone behind it who hasn't answered you tonight. */
export function knockNear(px: number, pz: number, range = 1.15): KnockDoor | null {
  if (!knockStore.on || knockStore.busy) return null;
  let best: KnockDoor | null = null, bd = range;
  for (const d of knockStore.doors) {
    const dist = Math.hypot(px - d.x, pz - d.z);
    if (dist < bd && nextAnswer(d, knockStore.treated)) { best = d; bd = dist; }
  }
  return best;
}
const LOCAL_KEY = "tsi.treats.v1";
const readLocal = (night: string): string[] => { try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") as Record<string, string[]>; return v[night] ?? []; } catch { return []; } };
const saveLocal = (night: string, list: string[]) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ [night]: list })); } catch { /* best effort */ } };
const words = (line: string) => line.replace(/^\[\w+\]\s*/, "");

/** Knock at a door: the next resident behind it answers with a treat (into the bag) and a line. */
export async function knockAt(door: KnockDoor): Promise<void> {
  const who = nextAnswer(door, knockStore.treated);
  if (!who || knockStore.busy) return;
  knockStore.busy = true;
  AudioManager.playSFX("footstep", { rate: 1.8, gain: 0.6 });
  window.setTimeout(() => AudioManager.playSFX("footstep", { rate: 1.8, gain: 0.6 }), 160);
  try {
    let got: { resident: string; name: string; line: string; item_key: string } | null = null;
    try {
      got = await apiCall<{ resident: string; name: string; line: string; item_key: string }>("/api/traditions/treat", "treat", { resident: who.slug });
    } catch (err) {
      const signedOut = err instanceof ApiError && (err.status === 401 || err.status === 503);
      if (!(signedOut && process.env.NODE_ENV !== "production")) {
        toast(err instanceof ApiError && err.status === 401 ? "Sign in to go trick-or-treating." : err instanceof Error ? err.message : "The door didn't open.");
        if (err instanceof ApiError && err.status === 409) knockStore.treated.add(who.slug);
        return;
      }
      // Development without a database: the same answer, kept on this device for the night.
      const { doorLine } = await import("@/lib/traditions/service");
      const { treatFor } = await import("@/lib/collections/treats");
      got = { resident: who.slug, name: who.name, line: doorLine(who.slug, knockStore.night), item_key: treatFor("local", who.slug, knockStore.night).key };
      knockStore.local = true;
    }
    knockStore.treated.add(got.resident);
    if (knockStore.local) saveLocal(knockStore.night, [...knockStore.treated]);
    const treat = TREATS.find(t => t.key === got!.item_key);
    toast(`${got.name}: “${words(got.line)}”`, treat?.icon ?? undefined);
    AudioManager.playBlip();
    if (treat) {
      window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: { key: treat.key, name: treat.name, rarity: treat.rarity, one_liner: treat.oneLiner, size: null, isNew: false, kind: "forage" } }));
      window.dispatchEvent(new CustomEvent("tsi:bag-got", { detail: { key: treat.key } }));
    }
  } finally {
    knockStore.busy = false;
  }
}

/** Tonight's answers from the server (or this device), when trick-or-treat starts for the night. */
function useTonight(on: boolean) {
  useEffect(() => {
    knockStore.on = on;
    if (!on) return;
    const night = nightKey(worldNow());
    knockStore.night = night;
    let alive = true;
    apiCall<{ on: boolean; night: string; treated: string[] }>("/api/traditions/treat", "tonight").then(
      t => { if (alive) { knockStore.treated = new Set(t.treated); knockStore.night = t.night; knockStore.local = false; } },
      () => { if (alive) { knockStore.treated = new Set(readLocal(night)); knockStore.local = true; } },
    );
    return () => { alive = false; knockStore.on = false; };
  }, [on]);
}

/** The layer: pumpkins while they're on, the fog-night mist (`fog`: 0 to 1, eased with the dark), the doors to knock at. */
export default function HalloweenLayer({ content, v, island, light, night, fog, weather, residents }: {
  content: Required<TraditionContent>; v: Village; island: VillageIsland; light: IslandLight; night: boolean;
  /** Fog-night strength now (DefaultIslandWorld eases it in with the dark). */
  fog: number; weather: IslandWeather; residents: readonly DoorResident[];
}) {
  const spots = useMemo(() => (content.pumpkins ? pumpkinSpots(v, island.standable) : []), [content.pumpkins, v, island]);
  const doors = useMemo(() => knockDoors(v, residents), [v, residents]);
  useEffect(() => { knockStore.doors = doors; }, [doors]);
  useTonight(content.trick_or_treat && night);
  const wind = useMemo(() => worldWind(weather), [weather]);
  return <Suspense fallback={null}>
    {spots.length > 0 && <PumpkinLanterns spots={spots} ground={island.ground} light={light} />}
    {/* Low ground mist on a fog night (a real fog day already has its own banks). */}
    {fog > 0.02 && weather !== "fog" && <MistBanks color={FOG_NIGHT.mist} opacity={0.3 * fog} wind={wind} ground={island.ground} />}
  </Suspense>;
}
