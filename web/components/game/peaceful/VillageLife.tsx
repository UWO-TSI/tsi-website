"use client";

/**
 * Foraging nodes and bugs on an island (specs/peaceful-loop.md §3–4).
 * Every node rolls a roster species per member and real hour (random rarity,
 * hourly personal respawn, lib/game/peaceful.ts). Rare rolls give a
 * diegetic tell: a sparkle (stronger on High) and a soft chime when you come
 * near. Bugs use the existing ACNH critter models (Critters.SPECIES) and
 * sneak-and-swing: rush in and they fly off; hold C to tiptoe, then E swings
 * the net. Harvest and catches post to /api/collections.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLBProp, NatureMushroom } from "../NatureModels";
import { SPECIES as CRITTERS } from "../Critters";
import { AudioManager } from "@/lib/game/audio";
import { collectWithSize, localCollections } from "@/lib/game/collections";
import { bugReaction, hasClue, hourKey, nodeAvailable, rollNode } from "@/lib/game/peaceful";
import { setPeacefulTarget } from "@/lib/game/peacefulNear";
import type { Biome, Species } from "@/lib/collections/roster";
import type { WorldMoment } from "@/lib/collections/logic";

export interface NodeSpec { id: string; x: number; z: number; biomes: Biome[]; categories: Species["category"][]; /** Tree canopy (fruit hangs up here). */ canopy?: boolean; /** Always this species (a tree's branch) instead of a roster roll. */ drop?: Species }

const HARVEST_KEY = "tsi.forage.harvested.v1";
function readHarvested(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(HARVEST_KEY) ?? "{}") as Record<string, string>; } catch { return {}; }
}
const FRUIT_COLOR: Record<string, string> = { apple: "#d8433b", peach: "#f4a38b", fruit_pear: "#b9c956", fruit_orange: "#f08a24", fruit_cherry: "#9c1f2e", fruit_coconut: "#7a5534", fruit_blackberry: "#3d2848", fruit_blueberry: "#3f5fb0" };
const MODEL_OF = new Map(CRITTERS.map(c => [c.key, c]));
const REACH = 1.7;

function Sparkle({ position, strong }: { position: [number, number, number]; strong: boolean }) {
  const glow = useTexture("/assets/sky/sun.png");
  const ref = useRef<THREE.SpriteMaterial>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.opacity = (strong ? 0.55 : 0.3) + Math.sin(clock.elapsedTime * 5 + position[0]) * 0.25; });
  return <sprite position={position} scale={strong ? [0.7, 0.7, 1] : [0.45, 0.45, 1]}>
    <spriteMaterial ref={ref} map={glow} color="#fff4b0" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
  </sprite>;
}

function NodeVisual({ sp, x, y, z, canopy }: { sp: Species; x: number; y: number; z: number; canopy?: boolean }) {
  if (sp.category === "fruit") {
    const color = FRUIT_COLOR[sp.key] ?? "#d8433b";
    const at: [number, number, number][] = canopy ? [[0.5, 2.1, -0.3], [-0.45, 2.3, -0.2], [0.1, 2.5, -0.55]] : [[0, 0.35, 0], [0.18, 0.28, 0.1]];
    return <group position={[x, y, z]}>{at.map((p, i) => <mesh key={i} position={p} castShadow><sphereGeometry args={[canopy ? 0.16 : 0.09, 10, 8]} /><meshStandardMaterial color={color} roughness={0.55} /></mesh>)}</group>;
  }
  if (sp.sub === "wood") return null; // still up in the tree until it's shaken
  if (sp.sub === "mushroom") return <NatureMushroom position={[x, y, z]} seed={sp.position} />;
  if (sp.model) return <GLBProp url={sp.model} position={[x, y + 0.02, z]} scale={1} castShadow={false} />;
  if (sp.category === "mineral") return <mesh position={[x, y + 0.12, z]}><dodecahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color={sp.key.includes("gold") ? "#e2b640" : sp.key.includes("crystal") ? "#b9e3f2" : "#8d8a84"} roughness={0.5} metalness={sp.key.includes("gold") ? 0.6 : 0} /></mesh>;
  // Flowers and anything without a model: a small bright tuft.
  return <mesh position={[x, y + 0.12, z]}><icosahedronGeometry args={[0.12, 0]} /><meshStandardMaterial color="#e9a3c3" roughness={0.7} /></mesh>;
}

interface LiveBug { id: string; sp: Species; x: number; z: number; baseY: number; fled: boolean; fleeT: number }

export default function VillageLife({ nodes, bugNodes, moment, member, player, ground, highTier, active }: {
  nodes: readonly NodeSpec[]; bugNodes: readonly NodeSpec[]; moment: WorldMoment; member: string;
  player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number; highTier: boolean; active: boolean;
}) {
  const [hour, setHour] = useState(() => hourKey(new Date()));
  const [harvested, setHarvested] = useState<Record<string, string>>(readHarvested);
  useEffect(() => { const t = window.setInterval(() => setHour(hourKey(new Date())), 30_000); return () => window.clearInterval(t); }, []);
  const now = useMemo(() => new Date(), [hour]); // eslint-disable-line react-hooks/exhaustive-deps -- re-evaluated each real hour
  const forage = useMemo(() => nodes.map(n => ({ n, sp: nodeAvailable(harvested[n.id], now) ? n.drop ?? rollNode(member, n.id, hour, n.biomes, moment, n.categories) : null })).filter(e => e.sp), [nodes, harvested, now, member, hour, moment]);
  const bugs = useMemo<LiveBug[]>(() => bugNodes.flatMap(n => {
    if (!nodeAvailable(harvested[n.id], now)) return [];
    const sp = rollNode(member, n.id, hour, n.biomes, moment, ["bug"]);
    if (!sp || !MODEL_OF.has(sp.key)) return [];
    return [{ id: n.id, sp, x: n.x, z: n.z, baseY: MODEL_OF.get(sp.key)!.baseY, fled: false, fleeT: 0 }];
  }), [bugNodes, harvested, now, member, hour, moment]);
  const bugState = useRef<Map<string, LiveBug>>(new Map());
  useEffect(() => { bugState.current = new Map(bugs.map(b => [b.id, { ...b }])); }, [bugs]);
  const groups = useRef(new Map<string, THREE.Group>());
  const last = useRef(new THREE.Vector3());
  const chimed = useRef(new Set<string>());

  const markHarvested = (id: string) => {
    const next = { ...readHarvested(), [id]: hourKey(new Date()) };
    try { localStorage.setItem(HARVEST_KEY, JSON.stringify(next)); } catch { /* session only */ }
    setHarvested(next);
  };

  useEffect(() => {
    const onAct = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      const node = forage.find(f => f.n.id === id);
      const bug = bugState.current.get(id);
      const sp = node?.sp ?? (bug && !bug.fled ? bug.sp : null);
      if (!sp) return;
      const isNew = !(sp.key in localCollections());
      const size = sp.size ? Math.round((sp.size[0] + (sp.size[1] - sp.size[0]) * Math.random()) * 10) / 10 : null;
      void collectWithSize(sp.key, size);
      markHarvested(id);
      AudioManager.playSFX(bug ? "confirm" : "click");
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `${isNew ? "NEW! " : ""}${bug ? "Caught" : "Got"} ${sp.name}${size ? `, ${size} cm` : ""}!` } }));
      window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: { key: sp.key, name: sp.name, rarity: sp.rarity, one_liner: sp.oneLiner, size, isNew, bug: !!bug } }));
    };
    window.addEventListener("tsi:peaceful-act", onAct);
    return () => window.removeEventListener("tsi:peaceful-act", onAct);
  });

  useFrame(({ clock }, delta) => {
    const p = player.current;
    // A jump of more than a stride in one frame is a spawn or teleport, not running at the bug.
    const step = Math.hypot(p.x - last.current.x, p.z - last.current.z);
    const speed = delta > 0 && step < 1 ? step / Math.min(delta, 0.1) : 0;
    last.current.copy(p);
    let best: { id: string; kind: "forage" | "bug"; label: string; distance: number } | null = null;
    for (const { n, sp } of forage) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (hasClue(sp) && d < 5 && !chimed.current.has(n.id)) { chimed.current.add(n.id); AudioManager.playSFX("blip3"); }
      if (d < REACH && (!best || d < best.distance)) best = { id: n.id, kind: "forage", label: n.canopy ? "Shake the tree" : sp!.category === "mineral" ? "Strike the rock" : sp!.sub === "shell" ? "Pick up the shell" : "Pick it", distance: d };
    }
    const t = clock.elapsedTime;
    for (const bug of bugState.current.values()) {
      const g = groups.current.get(bug.id);
      if (!g) continue;
      const model = MODEL_OF.get(bug.sp.key)!;
      if (bug.fled) {
        bug.fleeT += delta;
        g.position.y += delta * 3; g.position.x += delta * 2.2;
        g.visible = bug.fleeT < 1.4;
        continue;
      }
      const flutter = model.motion === "flutter" || model.motion === "drift" || model.motion === "dart";
      const bx = bug.x + (flutter ? Math.sin(t * 0.9 + bug.x) * 0.5 : 0), bz = bug.z + (flutter ? Math.cos(t * 0.7 + bug.z) * 0.4 : 0);
      g.position.set(bx, ground(bug.x, bug.z) + bug.baseY + (flutter ? Math.sin(t * 3 + bug.z) * 0.08 : 0), bz);
      const d = Math.hypot(bx - p.x, bz - p.z);
      const reaction = active ? bugReaction(d, speed, bug.sp.rarity) : "idle";
      if (reaction === "flee") { bug.fled = true; bug.fleeT = 0; AudioManager.playSFX("exit"); continue; }
      if (reaction === "catchable" && (!best || d < best.distance)) best = { id: bug.id, kind: "bug", label: `Swing the net (${bug.sp.name})`, distance: d };
    }
    setPeacefulTarget(best);
  });
  useEffect(() => () => setPeacefulTarget(null), []);

  return <>
    {forage.map(({ n, sp }) => {
      const y = ground(n.x, n.z);
      return <Suspense key={n.id} fallback={null}>
        <NodeVisual sp={sp!} x={n.x} y={y} z={n.z} canopy={n.canopy} />
        {hasClue(sp) && <Sparkle position={[n.x, y + (n.canopy ? 2.6 : 0.5), n.z]} strong={highTier} />}
      </Suspense>;
    })}
    {bugs.map(b => {
      const model = MODEL_OF.get(b.sp.key)!;
      return <group key={b.id} ref={g => { if (g) groups.current.set(b.id, g); else groups.current.delete(b.id); }}>
        <Suspense fallback={null}><GLBProp url={model.model} scale={model.scale} castShadow={false} /></Suspense>
        {hasClue(b.sp) && <Suspense fallback={null}><Sparkle position={[0, 0.35, 0]} strong={highTier} /></Suspense>}
      </group>;
    })}
  </>;
}
