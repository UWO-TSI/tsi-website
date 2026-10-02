"use client";

/**
 * Foraging nodes and bugs on an island (specs/peaceful-loop.md §3–4).
 * Every node rolls a roster species per member and real hour (random rarity,
 * hourly personal respawn, lib/game/peaceful.ts). Rare rolls give a
 * diegetic tell: a sparkle (stronger on High) and a soft chime when you come
 * near. Bugs use the existing ACNH critter models (Critters.SPECIES) and
 * sneak-and-swing: rush in and they fly off; crouch (Ctrl, or C) to tiptoe, then E swings
 * the net. The server rolls and records each harvest (the node's own roll
 * when signed out, kept in this browser).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLBProp, NatureMushroom } from "../NatureModels";
import { SPECIES as CRITTERS } from "../Critters";
import { AudioManager } from "@/lib/game/audio";
import { collect, harvestNode, localCollections, localRecord } from "@/lib/game/collections";
import { ROSTER } from "@/lib/collections/roster";
import { forageSize } from "@/lib/collections/rolls";
import { bugReaction, hasClue, hourKey, nodeAvailable, rollNode } from "@/lib/game/peaceful";
import { setPeacefulTarget, type PeacefulTarget } from "@/lib/game/peacefulNear";
import type { Biome, Species } from "@/lib/collections/roster";
import type { WorldMoment } from "@/lib/collections/logic";
import { worldTime } from "@/lib/game/worldClock";
import { FLEE_TIME, WARY_HOP, fleeAt, waryHop, type FleePose } from "@/lib/game/bugFlee";
import { DROP_TIME, FRUIT_MODEL, fruitTree, type TreeSpot } from "@/lib/game/treeFruit";
import TreeFruit, { type HangingFruit } from "./TreeFruit";

export interface NodeSpec { id: string; x: number; z: number; biomes: Biome[]; categories: Species["category"][]; /** Tree canopy (fruit hangs up here). */ canopy?: boolean; /** Always this species (a tree's branch) instead of a roster roll. */ drop?: Species; /** The tree a canopy node belongs to: its fruit hangs in this tree's crown. */ tree?: TreeSpot }

const HARVEST_KEY = "tsi.forage.harvested.v1";
function readHarvested(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(HARVEST_KEY) ?? "{}") as Record<string, string>; } catch { return {}; }
}
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

const buried = (sp: Species) => sp.tool === "shovel" && sp.category !== "mineral";

function NodeVisual({ sp, x, y, z, canopy }: { sp: Species; x: number; y: number; z: number; canopy?: boolean }) {
  if (sp.category === "fruit") {
    // Up in a crown it is TreeFruit's; on the ground (a coconut on the sand) it lies there, a little tipped over.
    // Fruit with no model (the berries) grows on no node yet.
    const url = FRUIT_MODEL[sp.key];
    return canopy || !url ? null : <GLBProp url={url} position={[x, y - 0.02, z]} rotation={[0.35, sp.position * 2.1, 0.2]} scale={0.55} />;
  }
  if (sp.sub === "wood") return null; // still up in the tree until it's shaken
  if (sp.sub === "mushroom") return <NatureMushroom position={[x, y, z]} seed={sp.position} />;
  // Buried (a shovel find that isn't a rock): only a dark dig spot shows in the sand.
  if (buried(sp)) return <mesh position={[x, y + 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.17, 10]} /><meshStandardMaterial color="#6e5a3e" roughness={1} /></mesh>;
  if (sp.model) return <GLBProp url={sp.model} position={[x, y + 0.02, z]} scale={1} />;
  if (sp.category === "mineral") return <mesh position={[x, y + 0.12, z]}><dodecahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color={sp.key.includes("gold") ? "#e2b640" : sp.key.includes("crystal") ? "#b9e3f2" : "#8d8a84"} roughness={0.5} metalness={sp.key.includes("gold") ? 0.6 : 0} /></mesh>;
  // A flower to pick: one bloom of its own kind (the cluster's ACNH models), a little smaller than a cluster's.
  if (sp.sub === "flower") return <GLBProp url={`/assets/acnh/plants/flower-${sp.key.replace(/^flower_/, "")}.glb`} position={[x, y, z]} rotation={[0, sp.position * 1.7, 0]} scale={0.42} />;
  return null;
}

interface LiveBug {
  id: string; sp: Species; x: number; z: number; baseY: number; fled: boolean; fleeT: number;
  /** The escape: where it took off, which way (away from you) and which way it curves. */
  fx: number; fy: number; fz: number; dir: number; side: number;
  /** The wary tell: seconds into its hop (-1 none), and whether it's wary now (the hop fires on the edge). */
  hopT: number; wary: boolean;
  /** Its materials were faded (an escape): restore them when the slot respawns. */
  faded: boolean;
  /** Its "net it" prompt, reused every frame. */
  target: PeacefulTarget;
}
const CRAWL = new Set(["crawl"]);
const _flee: FleePose = { x: 0, y: 0, z: 0, yaw: 0, opacity: 1 };

/** Module scope (the react compiler forbids writing through hook values): fade a bug's own materials. */
function fade(group: THREE.Group, opacity: number) {
  group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      // The critter models are opaque: blend only while fading.
      const blend = opacity < 1;
      if (m.transparent !== blend) { m.transparent = blend; m.depthWrite = !blend; m.needsUpdate = true; }
      m.opacity = opacity;
    }
  });
  group.visible = opacity > 0.01;
}

export default function VillageLife({ nodes, bugNodes, moment, member, player, ground, highTier, active, treeModels }: {
  nodes: readonly NodeSpec[]; bugNodes: readonly NodeSpec[]; moment: WorldMoment; member: string;
  player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number; highTier: boolean; active: boolean;
  /** The tree models this season draws (SEASON_TREES): the fruit hangs in the crown the tree shows. */
  treeModels?: readonly string[];
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
    return [{ id: n.id, sp, x: n.x, z: n.z, baseY: MODEL_OF.get(sp.key)!.baseY, fled: false, fleeT: 0, fx: 0, fy: 0, fz: 0, dir: 0, side: 1, hopT: -1, wary: false, faded: false,
      target: { id: n.id, kind: "bug" as const, label: `Swing the net (${sp.name})`, distance: 0 } }];
  }), [bugNodes, harvested, now, member, hour, moment]);
  const bugState = useRef<Map<string, LiveBug>>(new Map());
  useEffect(() => { bugState.current = new Map(bugs.map(b => [b.id, { ...b, target: { ...b.target } }])); }, [bugs]);
  // Each forage node's prompt, built once per roll and reused every frame (no allocation in the frame loop).
  const forageTargets = useMemo(() => new Map(forage.map(({ n, sp }) => [n.id, {
    id: n.id, kind: sp!.tool === "shovel" ? "dig" : "forage", distance: 0, at: [n.x, n.z],
    label: n.canopy ? "Shake the tree" : sp!.category === "mineral" ? "Strike the rock" : buried(sp!) ? "Dig it up" : sp!.sub === "shell" ? "Pick up the shell" : "Pick it",
  } satisfies PeacefulTarget])), [forage]);
  // The fruit hanging in the trees, and a shaken tree's fruit while it falls (DROP_TIME, then the node is gone).
  const [drops, setDrops] = useState<HangingFruit[]>([]);
  const hanging = useMemo<HangingFruit[]>(() => [...forage.flatMap(({ n, sp }) => {
    const tree = n.canopy && n.tree && sp!.category === "fruit" ? fruitTree(n.tree, ground(n.tree.x, n.tree.z), treeModels) : null;
    return tree ? [{ id: n.id, key: sp!.key, tree, shaken: null }] : [];
  }), ...drops], [forage, drops, ground, treeModels]);
  const groups = useRef(new Map<string, THREE.Group>());
  const last = useRef(new THREE.Vector3());
  const chimed = useRef(new Set<string>());

  const markHarvested = (id: string) => {
    const next = { ...readHarvested(), [id]: hourKey(new Date()) };
    try { localStorage.setItem(HARVEST_KEY, JSON.stringify(next)); } catch { /* session only */ }
    setHarvested(next);
    // A harvest in the first seconds of a new hour is that hour's (before the 30 s tick would catch up).
    setHour(next[id]);
  };

  useEffect(() => {
    const onAct = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      const node = forage.find(f => f.n.id === id);
      const bug = bugState.current.get(id);
      const sp = node?.sp ?? (bug && !bug.fled ? bug.sp : null);
      if (!sp) return;
      const shaken = hanging.find(f => f.id === id && f.shaken === null);
      if (shaken) {
        const drop = { ...shaken, shaken: performance.now() };
        setDrops(d => [...d, drop]);
        window.setTimeout(() => setDrops(d => d.filter(f => f !== drop)), DROP_TIME * 1000);
      }
      markHarvested(id);
      void harvestNode(id, [player.current.x, player.current.z]).then(answer => {
        if (answer && !answer.ok) { window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: answer.error } })); return; }
        // The server's roll is the catch (normally the same species this node showed).
        const got = answer ? ROSTER.find(s => s.key === answer.catch.item_key) ?? sp : sp;
        const size = answer ? answer.catch.size_cm : forageSize(got);
        const isNew = answer ? answer.catch.total_collected === 1 : !(got.key in localCollections());
        collect(got.key);
        localRecord(got.key, size);
        AudioManager.playSFX(bug ? "confirm" : "click");
        window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `${isNew ? "NEW! " : ""}${bug ? "Caught" : "Got"} ${got.name}${size ? `, ${size} cm` : ""}!` } }));
        if (answer?.catch.recipe) window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `You learned a recipe: ${answer.catch.recipe.name}` } }));
        window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: { key: got.key, name: got.name, rarity: got.rarity, one_liner: got.oneLiner, size, isNew, bug: !!bug } }));
      });
    };
    window.addEventListener("tsi:peaceful-act", onAct);
    return () => window.removeEventListener("tsi:peaceful-act", onAct);
  });

  useFrame((_, delta) => {
    const p = player.current;
    // A jump of more than a stride in one frame is a spawn or teleport, not running at the bug.
    const step = Math.hypot(p.x - last.current.x, p.z - last.current.z);
    const speed = delta > 0 && step < 1 ? step / Math.min(delta, 0.1) : 0;
    last.current.copy(p);
    let best: PeacefulTarget | null = null;
    for (const { n, sp } of forage) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (hasClue(sp) && d < 5 && !chimed.current.has(n.id)) { chimed.current.add(n.id); AudioManager.playSFX("blip3"); }
      const target = forageTargets.get(n.id);
      if (target && d < REACH && (!best || d < best.distance)) { target.distance = d; best = target; }
    }
    const t = worldTime();
    for (const bug of bugState.current.values()) {
      const g = groups.current.get(bug.id);
      if (!g) continue;
      const model = MODEL_OF.get(bug.sp.key)!;
      if (bug.fled) {
        // Away along its curve, fading out (never a pop).
        bug.fleeT += delta;
        if (bug.fleeT > FLEE_TIME + 0.1) continue;
        fleeAt(bug.fx, bug.fy, bug.fz, bug.dir, bug.side, CRAWL.has(model.motion), bug.fleeT, _flee);
        g.position.set(_flee.x, _flee.y, _flee.z);
        g.rotation.y = _flee.yaw;
        fade(g, _flee.opacity);
        bug.faded = true;
        continue;
      }
      if (!g.visible || bug.faded) { fade(g, 1); bug.faded = false; }
      const flutter = model.motion === "flutter" || model.motion === "drift" || model.motion === "dart";
      const bx = bug.x + (flutter ? Math.sin(t * 0.9 + bug.x) * 0.5 : 0), bz = bug.z + (flutter ? Math.cos(t * 0.7 + bug.z) * 0.4 : 0);
      // The wary tell: a quick hop when it first notices you creeping up.
      if (bug.hopT >= 0) { bug.hopT += delta; if (bug.hopT > WARY_HOP) bug.hopT = -1; }
      g.position.set(bx, ground(bug.x, bug.z) + bug.baseY + (flutter ? Math.sin(t * 3 + bug.z) * 0.08 : 0) + waryHop(bug.hopT), bz);
      const d = Math.hypot(bx - p.x, bz - p.z);
      const reaction = active ? bugReaction(d, speed, bug.sp.rarity) : "idle";
      if (reaction === "flee") {
        // Away from you, curving off to a side seeded by the bug, from where it was.
        bug.fled = true; bug.fleeT = 0; bug.fx = g.position.x; bug.fy = g.position.y; bug.fz = g.position.z;
        bug.dir = Math.atan2(bx - p.x, bz - p.z); bug.side = bug.x * 7.3 + bug.z * 3.1 - Math.floor(bug.x * 7.3 + bug.z * 3.1) < 0.5 ? 1 : -1;
        AudioManager.playSFX("exit");
        continue;
      }
      const wary = reaction === "wary" || reaction === "catchable";
      if (wary && !bug.wary && bug.hopT < 0) bug.hopT = 0;
      bug.wary = wary;
      if (reaction === "catchable" && (!best || d < best.distance)) { bug.target.distance = d; best = bug.target; }
    }
    setPeacefulTarget(best);
  });
  useEffect(() => () => setPeacefulTarget(null), []);

  return <>
    <TreeFruit fruit={hanging} ground={ground} />
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
        <Suspense fallback={null}><GLBProp url={model.model} scale={model.scale} /></Suspense>
        {hasClue(b.sp) && <Suspense fallback={null}><Sparkle position={[0, 0.35, 0]} strong={highTier} /></Suspense>}
      </group>;
    })}
  </>;
}
