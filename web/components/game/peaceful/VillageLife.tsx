"use client";

/**
 * Foraging nodes and bugs on an island (specs/peaceful-loop.md §3–4; specs/polish/forage-craft-museum.md).
 * Every node rolls a roster species per member and real hour (random rarity, hourly personal respawn, row 83: each
 * player's own instance; lib/game/peaceful.ts). Rare rolls give a diegetic tell: a sparkle (stronger on High) and a
 * soft chime when you come near. Bugs use the ACNH critter models (Critters.SPECIES) and sneak-and-swing: rush in and
 * they fly off; crouch (Ctrl, or C) to tiptoe, then the net. The server rolls and records each harvest (the node's own
 * roll when signed out, kept in this browser).
 *
 * Every act lands on its clip's contact frame (lib/game/actTiming.ts), never on the key press: shaking a tree wobbles
 * it on the first push (the shake belongs to the tree, on the world clock: lib/game/treeShake.ts), leaf bits fall out
 * of its crown and the fruit hanging nearest you (or a branch) lets go, bounces and rolls to rest at your feet
 * (lib/game/forageWorld.ts); picking something up takes it at the grab, and only once the server has said it's yours,
 * lifting it into the picker's hand (lib/game/forageLift.ts) for the Bag's fly-in and the reward card. A full bag
 * leaves it where it is, with the note over it.
 */
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLBProp, NatureMushroom } from "../NatureModels";
import { SPECIES as CRITTERS } from "../Critters";
import { useMoveParticles } from "../movement/moveFx";
import { AudioManager } from "@/lib/game/audio";
import { collect, harvestNode, localCollections, localRecord } from "@/lib/game/collections";
import { bagRoom } from "@/lib/game/bagStore";
import { ROSTER } from "@/lib/collections/roster";
import { forageSize } from "@/lib/collections/rolls";
import { bugReaction, hasClue, hourKey, nodeAvailable, rollNode } from "@/lib/game/peaceful";
import { setPeacefulTarget, type PeacefulTarget } from "@/lib/game/peacefulNear";
import type { Biome, Species } from "@/lib/collections/roster";
import type { WorldMoment } from "@/lib/collections/logic";
import type { ClipName } from "@/lib/game/character/clips";
import { worldTime } from "@/lib/game/worldClock";
import { FLEE_TIME, WARY_HOP, carryBugs, fleeAt, waryHop, type FleePose } from "@/lib/game/bugFlee";
import { FRUIT_MODEL, fruitTree, hangAt, nearestHang, type Point, type TreeSpot } from "@/lib/game/treeFruit";
import { SHAKE, WORLD_SHAKES, fallAt, restPoint, type Fall } from "@/lib/game/treeShake";
import { contactDelay, hitDelays, landAt } from "@/lib/game/actTiming";
import { addDrop, dropsFor, dropsVersion, removeDrop, setFallen, fallenOf, subscribeDrops, type Drop } from "@/lib/game/forageWorld";
import { LIFT, handOf, liftPose, type Lift } from "@/lib/game/forageLift";
import { FACE, seedAt, type Recipe } from "@/lib/game/fx/particles";
import { TREE_WIND, WORLD_SNOW, leafTintHex, prepareModel } from "@/lib/game/modelMaterials";
import TreeFruit, { FRUIT_REST_RADIUS, type HangingFruit } from "./TreeFruit";

export interface NodeSpec { id: string; x: number; z: number; biomes: Biome[]; categories: Species["category"][]; /** Tree canopy (fruit hangs up here). */ canopy?: boolean; /** Always this species (a tree's branch) instead of a roster roll. */ drop?: Species; /** The tree a canopy node belongs to: its fruit hangs in this tree's crown. */ tree?: TreeSpot }

const HARVEST_KEY = "tsi.forage.harvested.v1";
function readHarvested(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(HARVEST_KEY) ?? "{}") as Record<string, string>; } catch { return {}; }
}
const MODEL_OF = new Map(CRITTERS.map(c => [c.key, c]));
/** How near you stand to pick by hand, to shake a tree (its trunk blocks at 0.65), and to pick up what fell. */
const REACH = 1.7, TREE_REACH = 1.25, DROP_REACH = 1.35;
const BRANCH_URL = "/assets/game/props/branch.glb";
/** The branch is authored at the character rig's scale (CHARACTER_SCALE, like the workbench's). */
const BRANCH_SCALE = 1.3, BRANCH_RADIUS = 0.05;

function Sparkle({ position, strong }: { position: [number, number, number]; strong: boolean }) {
  const glow = useTexture("/assets/sky/sun.png");
  const ref = useRef<THREE.SpriteMaterial>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.opacity = (strong ? 0.55 : 0.3) + Math.sin(clock.elapsedTime * 5 + position[0]) * 0.25; });
  return <sprite position={position} scale={strong ? [0.5, 0.5, 1] : [0.34, 0.34, 1]}>
    <spriteMaterial ref={ref} map={glow} color="#fff4b0" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
  </sprite>;
}

const buried = (sp: Species) => sp.tool === "shovel" && sp.category !== "mineral";
/** Just over a tree's crown (where a rare tree's sparkle shows): its highest fruit, sized with the tree. */
function crownTop(n: NodeSpec, models?: readonly string[]): number {
  const tree = n.tree && fruitTree(n.tree, 0, models);
  return tree ? Math.max(...tree.hang.map(h => h[1])) * tree.scale + 0.5 : 2.6;
}

/** A node's model where it lies, at its group's origin (the group lifts it into a hand when it's taken). */
function NodeVisual({ sp, canopy }: { sp: Species; canopy?: boolean }) {
  if (sp.category === "fruit") {
    // Up in a crown it is TreeFruit's; on the ground (a coconut on the sand) it lies there, a little tipped over.
    // Fruit with no model (the berries) grows on no node yet.
    const url = FRUIT_MODEL[sp.key];
    return canopy || !url ? null : <GLBProp url={url} position={[0, -0.02, 0]} rotation={[0.35, sp.position * 2.1, 0.2]} scale={0.55} />;
  }
  if (sp.sub === "wood") return null; // still up in the tree until it's shaken
  if (sp.sub === "mushroom") return <NatureMushroom position={[0, 0, 0]} seed={sp.position} />;
  // Buried (a shovel find that isn't a rock): only a dark dig spot shows in the sand.
  if (buried(sp)) return <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.17, 10]} /><meshStandardMaterial color="#6e5a3e" roughness={1} /></mesh>;
  if (sp.model) return <GLBProp url={sp.model} position={[0, 0.02, 0]} scale={1} />;
  if (sp.category === "mineral") return <mesh position={[0, 0.12, 0]}><dodecahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color={sp.key.includes("gold") ? "#e2b640" : sp.key.includes("crystal") ? "#b9e3f2" : "#8d8a84"} roughness={0.5} metalness={sp.key.includes("gold") ? 0.6 : 0} /></mesh>;
  // A flower to pick: one bloom of its own kind (the cluster's ACNH models), a little smaller than a cluster's.
  if (sp.sub === "flower") return <GLBProp url={`/assets/acnh/plants/flower-${sp.key.replace(/^flower_/, "")}.glb`} position={[0, 0, 0]} rotation={[0, sp.position * 1.7, 0]} scale={0.42} />;
  return null;
}

const _fall: Fall = { x: 0, y: 0, z: 0, spin: 0 }, _liftOut = { x: 0, y: 0, z: 0, scale: 1 };
/** Module scope (the react compiler forbids writing through hook values): a fallen branch where its fall has it. */
function placeBranch(g: THREE.Group | null, d: Drop, lift: Lift | undefined, now: number) {
  if (!g) return;
  const t = worldTime() - d.t0;
  if (t < 0) { g.visible = false; return; }
  const phase = fallAt(d.from, d.rest, d.groundY, BRANCH_RADIUS, t, _fall);
  g.visible = true;
  g.position.set(_fall.x, _fall.y - BRANCH_RADIUS, _fall.z);
  // Tumbling end over end on the way down, then lying along its rest heading, rolling about its own length.
  g.rotation.set(phase === "falling" ? _fall.spin * 1.4 : _fall.spin * 0.6, d.yaw, phase === "falling" ? Math.sin(_fall.spin) * 0.6 : 0, "YXZ");
  let s = BRANCH_SCALE;
  if (lift && !liftPose(lift, now, _liftOut)) { g.visible = false; return; }
  if (lift) { g.position.set(_liftOut.x, _liftOut.y, _liftOut.z); s *= _liftOut.scale; }
  g.scale.setScalar(s);
}

function FallenBranch({ drop, lifts }: { drop: Drop; lifts: ReadonlyMap<string, Lift> }) {
  const { scene } = useGLTF(BRANCH_URL);
  const model = useMemo(() => prepareModel(scene, BRANCH_URL), [scene]);
  const group = useRef<THREE.Group>(null);
  useFrame(() => placeBranch(group.current, drop, lifts.get(drop.nodeId), performance.now()));
  return <group ref={group} visible={false}><primitive object={model} /></group>;
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

/**
 * Module scope (the react compiler forbids writing through hook values): fade a bug's own materials. Its rare
 * sparkle is not faded but dropped the moment it flees: a glow trailing off with the bug read as a lit orb flying away.
 */
function fade(group: THREE.Group, opacity: number, sparkle = opacity >= 1) {
  group.traverse(o => {
    if ((o as THREE.Sprite).isSprite) { o.visible = sparkle; return; }
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
/** Module scope (the react compiler forbids writing through hook values): start and end a thing's lift into a hand. */
const setLift = (lifts: Map<string, Lift>, id: string, lift: Lift) => { lifts.set(id, lift); };
const endLift = (lifts: Map<string, Lift>, id: string) => { lifts.delete(id); };
/** Module scope: a node (or a netted bug) on its way into the hand; false once it's gone in. */
function liftGroup(g: THREE.Group, lift: Lift, now: number, base: number): boolean {
  const on = liftPose(lift, now, _liftOut);
  g.position.set(_liftOut.x, _liftOut.y, _liftOut.z);
  g.scale.setScalar(base * _liftOut.scale);
  g.visible = on;
  return on;
}

/** What a gathering act is: shake a tree, pick up what's lying there, pick by hand, strike a rock, dig, net a bug. */
type ActKind = "shake" | "pickup" | "pick" | "strike" | "dig" | "net";
/** One act in flight (written by events and timers, read by the frame loop). */
interface Act {
  kind: ActKind; nodeId: string; clip: ClipName; sp: Species;
  /** performance.now() of the contact frame, and the server's answer when it has come. */
  contactAt: number; answer: { ok: boolean; at: number } | null; landed: boolean;
  /** The one acting: where they stood and which way they faced (the hand the thing goes to is theirs). */
  actor: Point & { yaw: number };
  /** Where the thing lies (its lift starts here). */
  at: Point;
  /** What the server said it was (or this browser's roll, signed out), once it has answered yes. */
  result?: { got: Species; size: number | null; isNew: boolean; recipe: { id: string; name: string } | null };
}

// ── Effects (our particle pack, on the object they belong to) ──────────────────────────────────────────────────────
/** Leaf bits shaken out of a crown: a few at a time, tumbling down through the leaves on the shared wind. */
const LEAF_FALL: Recipe = { sprite: "leafBits", count: [4, 5], life: [1.5, 2.3], size: [0.34, 0.44], grow: 1, speed: [0.25, 0.8], spread: Math.PI, up: [-0.3, 0.3],
  gravity: 0.55, drag: 1.6, wind: 0.9, spin: 2.2, fps: 9, alpha: 1, face: FACE.billboard, jitter: 0.85, rise: [-0.25, 0.45] };
const LEAF_SINGLE: Recipe = { ...LEAF_FALL, sprite: "leaf", count: [3, 4], size: [0.2, 0.26], fps: 12 };
const PETAL_FALL: Recipe = { ...LEAF_FALL, sprite: "petal", size: [0.18, 0.24], count: [5, 7], gravity: 0.4, fps: 8 };
const SNOW_FALL: Recipe = { sprite: "snow", count: [3, 4], life: [0.7, 0.95], size: [0.5, 0.7], grow: 1.5, speed: [0.2, 0.5], spread: Math.PI, up: [-0.6, -0.2],
  gravity: 1.4, drag: 2.2, wind: 0.5, alpha: 0.9, face: FACE.billboard, jitter: 0.8, rise: [-0.3, 0.3] };
/** A fallen fruit's landing: a small puff of whatever it lands on. */
const THUD: Recipe = { sprite: "dustLow", count: [3, 4], life: [0.35, 0.45], size: [0.32, 0.4], grow: 1.4, speed: [0.6, 1], spread: 0, up: [0, 0.05], gravity: 0, drag: 5,
  wind: 0.4, lift: 0.05, alpha: 0.75, face: FACE.standing, jitter: 0.04 };
const SNOW_TINT = 0xf4f8fc, PETAL_TINT = 0xf5b8cf, DUST_TINT = 0xd6c8a4;

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
  // Every node's roll this hour (a taken one too: a picked tree still carries the rest of its fruit), then what's out.
  const rolled = useMemo(() => nodes.map(n => ({ n, sp: n.drop ?? rollNode(member, n.id, hour, n.biomes, moment, n.categories), out: nodeAvailable(harvested[n.id], now) })),
    [nodes, harvested, now, member, hour, moment]);
  const forage = useMemo(() => rolled.filter(e => e.out && e.sp), [rolled]);
  const bugs = useMemo<LiveBug[]>(() => bugNodes.flatMap(n => {
    if (!nodeAvailable(harvested[n.id], now)) return [];
    const sp = rollNode(member, n.id, hour, n.biomes, moment, ["bug"]);
    if (!sp || !MODEL_OF.has(sp.key)) return [];
    return [{ id: n.id, sp, x: n.x, z: n.z, baseY: MODEL_OF.get(sp.key)!.baseY, fled: false, fleeT: 0, fx: 0, fy: 0, fz: 0, dir: 0, side: 1, hopT: -1, wary: false, faded: false,
      target: { id: n.id, kind: "bug" as const, label: sp.name, distance: 0, clip: "Net" as const } }];
  }), [bugNodes, harvested, now, member, hour, moment]);
  const bugState = useRef<Map<string, LiveBug>>(new Map());
  // Carried by slot and species, so a harvest anywhere never resets a bug that fled (lib/game/bugFlee carryBugs).
  useEffect(() => { bugState.current = carryBugs(bugState.current, bugs.map(b => ({ ...b, target: { ...b.target } }))); }, [bugs]);
  // What's lying on the ground, shaken down this hour and not picked up yet.
  const dropsV = useSyncExternalStore(subscribeDrops, dropsVersion, () => 0);
  const lying = useMemo(() => dropsFor(hour), [hour, dropsV]); // eslint-disable-line react-hooks/exhaustive-deps -- dropsV is the store's version
  const lyingByNode = useMemo(() => new Map(lying.map(d => [d.nodeId, d])), [lying]);
  // Each node's prompt (and its act's clip), built once per roll and reused every frame (no allocation in the frame loop).
  const forageTargets = useMemo(() => new Map(forage.map(({ n, sp }) => {
    const drop = lyingByNode.get(n.id);
    const label = drop ? `Pick up the ${drop.kind === "branch" ? "branch" : sp!.name.toLowerCase()}`
      : n.canopy ? "Shake the tree" : sp!.category === "mineral" ? "Strike the rock" : buried(sp!) ? "Dig it up"
      : sp!.sub === "shell" ? "Pick up the shell" : sp!.category === "fruit" ? `Pick up the ${sp!.name.toLowerCase()}` : "Pick it";
    const clip: ClipName = drop ? "Pickup" : n.canopy ? "Shake" : sp!.category === "mineral" ? "Strike" : buried(sp!) ? "Dig"
      : sp!.sub === "flower" || sp!.sub === "mushroom" ? "Forage" : "Pickup";
    return [n.id, { id: n.id, kind: sp!.tool === "shovel" ? "dig" : "forage", distance: 0, at: drop ? [drop.rest.x, drop.rest.z] : [n.x, n.z], label, clip } satisfies PeacefulTarget];
  })), [forage, lyingByNode]);
  // The fruit in the trees: every fruiting crown this hour, less the one that fell (lying there, or taken).
  const hanging = useMemo<HangingFruit[]>(() => rolled.flatMap(({ n, sp, out }) => {
    const tree = n.canopy && n.tree && sp?.category === "fruit" ? fruitTree(n.tree, ground(n.tree.x, n.tree.z), treeModels) : null;
    if (!tree) return [];
    const drop = lyingByNode.get(n.id) ?? null;
    return [{ id: n.id, key: sp!.key, tree, drop, fallen: drop ? drop.k : out ? -1 : fallenOf(n.id, hour) }];
  }), [rolled, ground, treeModels, lyingByNode, hour]);
  const branches = useMemo(() => lying.filter(d => d.kind === "branch"), [lying]);
  const groups = useRef(new Map<string, THREE.Group>());
  const nodeGroups = useRef(new Map<string, THREE.Group>());
  // Things on their way into a hand, by node: the same map for the frame loop here and the fruit and branches' own.
  const lifts = useMemo(() => new Map<string, Lift>(), []);
  const acts = useRef(new Map<string, Act>());
  const last = useRef(new THREE.Vector3());
  const chimed = useRef(new Set<string>());
  const fx = useMoveParticles();

  const markHarvested = (id: string) => {
    const next = { ...readHarvested(), [id]: hourKey(new Date()) };
    try { localStorage.setItem(HARVEST_KEY, JSON.stringify(next)); } catch { /* session only */ }
    setHarvested(next);
    // A harvest in the first seconds of a new hour is that hour's (before the 30 s tick would catch up).
    setHour(next[id]);
  };

  useEffect(() => {
    const later = (ms: number, fn: () => void) => window.setTimeout(fn, Math.max(0, ms));
    /** Shake: the wobble and the leaves on each push; on the first, what it lets go of starts to fall. */
    const shake = (n: NodeSpec, sp: Species, actor: Act["actor"]) => {
      const tree = n.tree!, gy = ground(tree.x, tree.z), fruit = sp.category === "fruit" ? fruitTree(tree, gy, treeModels) : null;
      const crown = gy + (fruit ? Math.max(...fruit.hang.map(h => h[1])) * fruit.scale * 0.85 : 2.1);
      hitDelays("Shake").forEach((ms, i) => later(ms, () => {
        const t = worldTime();
        WORLD_SHAKES.start(tree.x, tree.z, t, SHAKE.amp * (i ? 0.75 : 1));
        // What the crown holds this season: petals off a blossom, snow off a snowy one, else its leaves.
        const snowy = WORLD_SNOW.value >= 0.5, blossom = !!fruit && /blossom/.test(String(treeModels?.[0] ?? ""));
        const seed = seedAt(tree.x, tree.z, 40 + i);
        if (snowy) fx.pool.burst(SNOW_FALL, tree.x, crown, tree.z, gy, 0, 0, 1, SNOW_TINT, seed);
        else {
          fx.pool.burst(blossom ? PETAL_FALL : LEAF_FALL, tree.x, crown, tree.z, gy, 0, 0, i ? 0.8 : 1, blossom ? PETAL_TINT : leafTintHex(), seed);
          fx.pool.burst(LEAF_SINGLE, tree.x, crown - 0.3, tree.z, gy, 0, 0, 1, leafTintHex(), seed ^ 0x5bd1e995);
        }
        AudioManager.playSFX("footstep", { rate: 1.25 + i * 0.1, gain: 0.42 - i * 0.08 });
        if (i) return;
        // The first push lets go of one: the fruit hanging nearest you, or a branch from your side of the crown.
        let from: Point, k = -1;
        if (fruit) {
          k = nearestHang(fruit, actor.x, actor.z, t);
          from = hangAt(fruit, k, t, TREE_WIND.value.y, { x: 0, y: 0, z: 0 });
        } else {
          const dx = actor.x - tree.x, dz = actor.z - tree.z, l = Math.hypot(dx, dz) || 1;
          from = { x: tree.x + (dx / l) * 0.45, y: gy + 1.85, z: tree.z + (dz / l) * 0.45 };
        }
        const rest = restPoint(tree, from, actor, fruit ? 0.45 : 0.3);
        const restY = ground(rest.x, rest.z);
        addDrop({ nodeId: n.id, key: sp.key, kind: fruit ? "fruit" : "branch", hour, k, from, rest, groundY: restY, t0: t, yaw: Math.atan2(rest.x - tree.x, rest.z - tree.z) + Math.PI / 2 });
        if (fruit) setFallen(n.id, hour, k);
        // Its landing: a thud and a little puff where it hits.
        later(Math.sqrt((2 * Math.max(0, from.y - restY - (fruit ? FRUIT_REST_RADIUS : BRANCH_RADIUS))) / 9.8) * 1000, () => {
          fx.pool.burst(THUD, from.x, ground(from.x, from.z), from.z, ground(from.x, from.z), 0, 0, fruit ? 0.8 : 1, DUST_TINT, seedAt(from.x, from.z, 47));
          AudioManager.playSFX("footstep", { rate: fruit ? 0.62 : 0.8, gain: 0.6 });
        });
      }));
    };
    /** Take it: at the contact, once the server has said yes, it lifts into the hand; then the card, the Bag and the mark. */
    const tryLand = (act: Act) => {
      const when = landAt(act.contactAt, act.answer);
      if (when === null || act.landed) return;
      later(when - performance.now(), () => {
        if (act.landed) return;
        act.landed = true;
        const hand = handOf(act.actor, act.actor.yaw);
        setLift(lifts, act.nodeId, { t0: performance.now(), from: { ...act.at }, to: hand, ms: LIFT.ms });
        AudioManager.playSFX("click", { rate: 1.55, gain: 0.45 });
        later(LIFT.ms, () => finish(act));
      });
    };
    const finish = (act: Act) => {
      if (act.result) {
        const { got, size, isNew, recipe } = act.result;
        collect(got.key);
        localRecord(got.key, size);
        // The shared reward card says what it was, with its art and its chime (RewardCard); the token flies into the Bag.
        window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: { key: got.key, name: got.name, rarity: got.rarity, one_liner: got.oneLiner, size, isNew,
          kind: act.kind === "net" ? "bug" : act.kind === "dig" ? "dig" : "forage" } }));
        window.dispatchEvent(new CustomEvent("tsi:bag-got", { detail: { key: got.key } }));
        // A rare find that taught a recipe: its card follows the catch's.
        if (recipe) window.dispatchEvent(new CustomEvent("tsi:recipe-learned", { detail: recipe }));
      }
      removeDrop(act.nodeId);
      markHarvested(act.nodeId);
      endLift(lifts, act.nodeId);
      acts.current.delete(act.nodeId);
    };
    const onAct = (e: Event) => {
      const { id, tool } = (e as CustomEvent<{ id: string; tool?: string }>).detail;
      if (acts.current.has(id)) return; // already at it
      const node = forage.find(f => f.n.id === id);
      const bug = bugState.current.get(id);
      const sp = node?.sp ?? (bug && !bug.fled ? bug.sp : null);
      if (!sp) return;
      const p = player.current, drop = node ? lyingByNode.get(id) ?? null : null;
      const at: Point = drop ? { x: drop.rest.x, y: drop.groundY, z: drop.rest.z } : node ? { x: node.n.x, y: ground(node.n.x, node.n.z), z: node.n.z } : { x: bug!.x, y: ground(bug!.x, bug!.z) + bug!.baseY, z: bug!.z };
      const actor = { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(at.x - p.x, at.z - p.z) };
      // A tree still holding what it gives: shake it (nothing's taken yet, so no bag check and no server).
      if (node?.n.canopy && !drop) {
        const clip: ClipName = "Shake";
        acts.current.set(id, { kind: "shake", nodeId: id, clip, sp, contactAt: performance.now() + contactDelay(clip), answer: null, landed: false, actor, at });
        later(hitDelays(clip).at(-1)! + 200, () => acts.current.delete(id));
        shake(node.n, sp, actor);
        return;
      }
      const kind: ActKind = bug ? "net" : drop ? "pickup" : sp.category === "mineral" ? "strike" : buried(sp) ? "dig" : sp.sub === "flower" || sp.sub === "mushroom" ? "pick" : "pickup";
      const clip: ClipName = bug ? "Net" : forageTargets.get(id)?.clip ?? "Forage";
      // A full bag (specs/game-ui.md §5): it stays in the world, and the note says why, over it.
      if (!bagRoom(sp.key)) { window.dispatchEvent(new CustomEvent("tsi:bag-full", { detail: { x: at.x, z: at.z } })); return; }
      const act: Act = { kind, nodeId: id, clip, sp, contactAt: performance.now() + contactDelay(clip), answer: null, landed: false, actor, at };
      acts.current.set(id, act);
      later(contactDelay(clip), () => tryLand(act));
      void harvestNode(id, [p.x, p.z], tool).then(answer => {
        const t = performance.now();
        if (answer && !answer.ok) {
          act.answer = { ok: false, at: t };
          acts.current.delete(id);
          if (answer.code === "bag_full") { window.dispatchEvent(new CustomEvent("tsi:bag-full", { detail: { x: at.x, z: at.z } })); return; }
          // Gathered here already this hour (another device): it's gone.
          if (answer.code === "already_harvested") { removeDrop(id); markHarvested(id); }
          window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: answer.error } }));
          return;
        }
        // The server's roll is the catch (normally the same species this node showed).
        const got = answer ? ROSTER.find(s => s.key === answer.catch.item_key) ?? sp : sp;
        act.result = { got, size: answer ? answer.catch.size_cm : forageSize(got), isNew: answer ? answer.catch.total_collected === 1 : !(got.key in localCollections()),
          recipe: answer?.catch.recipe ? { id: answer.catch.recipe.id, name: answer.catch.recipe.name } : null };
        act.answer = { ok: true, at: t };
        tryLand(act);
      });
    };
    window.addEventListener("tsi:peaceful-act", onAct);
    return () => window.removeEventListener("tsi:peaceful-act", onAct);
  });

  useFrame((_, delta) => {
    const p = player.current, nowMs = performance.now();
    // A jump of more than a stride in one frame is a spawn or teleport, not running at the bug.
    const step = Math.hypot(p.x - last.current.x, p.z - last.current.z);
    const speed = delta > 0 && step < 1 ? step / Math.min(delta, 0.1) : 0;
    last.current.copy(p);
    let best: PeacefulTarget | null = null;
    for (const { n, sp } of forage) {
      const target = forageTargets.get(n.id);
      if (!target || acts.current.has(n.id)) continue;
      const [tx, tz] = target.at!;
      const d = Math.hypot(tx - p.x, tz - p.z);
      // The rare tell's chime: the success sound high and soft (a twinkle), never a dialogue blip.
      if (hasClue(sp) && d < 5 && !chimed.current.has(n.id)) { chimed.current.add(n.id); AudioManager.playSFX("confirm", { rate: 1.9, gain: 0.22 }); }
      const drop = target.clip === "Pickup" && n.canopy ? lyingByNode.get(n.id) : undefined;
      // What fell can be picked up once it's down (rolling or resting), not mid-air.
      if (drop && worldTime() - drop.t0 < Math.sqrt((2 * Math.max(0, drop.from.y - drop.groundY)) / 9.8)) continue;
      const reach = drop ? DROP_REACH : n.canopy ? TREE_REACH : REACH;
      if (d < reach && (!best || d < best.distance)) { target.distance = d; best = target; }
    }
    // Things on their way into a hand.
    for (const [id, lift] of lifts) { const g = nodeGroups.current.get(id) ?? groups.current.get(id); if (g) liftGroup(g, lift, nowMs, g.userData.base ?? 1); }
    const t = worldTime();
    for (const bug of bugState.current.values()) {
      const g = groups.current.get(bug.id);
      if (!g || lifts.has(bug.id)) continue;
      const model = MODEL_OF.get(bug.sp.key)!;
      if (bug.fled) {
        // Away along its curve, fading out (never a pop).
        bug.fleeT += delta;
        if (bug.fleeT > FLEE_TIME + 0.1) continue;
        fleeAt(bug.fx, bug.fy, bug.fz, bug.dir, bug.side, CRAWL.has(model.motion), bug.fleeT, _flee);
        g.position.set(_flee.x, _flee.y, _flee.z);
        g.rotation.y = _flee.yaw;
        fade(g, _flee.opacity, false);
        bug.faded = true;
        continue;
      }
      if (!g.visible || bug.faded) { fade(g, 1); bug.faded = false; }
      const flutter = model.motion === "flutter" || model.motion === "drift" || model.motion === "dart";
      const bx = bug.x + (flutter ? Math.sin(t * 0.9 + bug.x) * 0.5 : 0), bz = bug.z + (flutter ? Math.cos(t * 0.7 + bug.z) * 0.4 : 0);
      // The wary tell: a quick hop when it first notices you creeping up.
      if (bug.hopT >= 0) { bug.hopT += delta; if (bug.hopT > WARY_HOP) bug.hopT = -1; }
      g.position.set(bx, ground(bug.x, bug.z) + bug.baseY + (flutter ? Math.sin(t * 3 + bug.z) * 0.08 : 0) + waryHop(bug.hopT), bz);
      // Being netted: it holds still for the swing.
      const act = acts.current.get(bug.id);
      if (act) { act.at.x = g.position.x; act.at.y = g.position.y; act.at.z = g.position.z; continue; }
      const d = Math.hypot(bx - p.x, bz - p.z);
      const reaction = active ? bugReaction(d, speed, bug.sp.rarity) : "idle";
      if (reaction === "flee") {
        // Away from you, curving off to a side seeded by the bug, from where it was.
        bug.fled = true; bug.fleeT = 0; bug.fx = g.position.x; bug.fy = g.position.y; bug.fz = g.position.z;
        bug.dir = Math.atan2(bx - p.x, bz - p.z); bug.side = bug.x * 7.3 + bug.z * 3.1 - Math.floor(bug.x * 7.3 + bug.z * 3.1) < 0.5 ? 1 : -1;
        // Its wings brushing off (a quick, high brush), never the door sound.
        AudioManager.playSFX("footstep", { rate: 1.7, gain: 0.45 });
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
    <TreeFruit fruit={hanging} lifts={lifts} />
    {branches.map(d => <Suspense key={d.nodeId} fallback={null}><FallenBranch drop={d} lifts={lifts} /></Suspense>)}
    {forage.map(({ n, sp }) => {
      const y = ground(n.x, n.z);
      return <Suspense key={n.id} fallback={null}>
        <group position={[n.x, y, n.z]} ref={g => { if (g) nodeGroups.current.set(n.id, g); else nodeGroups.current.delete(n.id); }}>
          <NodeVisual sp={sp!} canopy={n.canopy} />
        </group>
        {hasClue(sp) && !lyingByNode.has(n.id) && <Sparkle position={[n.x, y + (n.canopy ? crownTop(n, treeModels) : 0.5), n.z]} strong={highTier} />}
      </Suspense>;
    })}
    {bugs.map(b => {
      const model = MODEL_OF.get(b.sp.key)!;
      return <group key={b.id} ref={g => { if (g) { g.userData.base = 1; groups.current.set(b.id, g); } else groups.current.delete(b.id); }}>
        <Suspense fallback={null}><GLBProp url={model.model} scale={model.scale} /></Suspense>
        {hasClue(b.sp) && <Suspense fallback={null}><Sparkle position={[0, 0.35, 0]} strong={highTier} /></Suspense>}
      </group>;
    })}
  </>;
}
