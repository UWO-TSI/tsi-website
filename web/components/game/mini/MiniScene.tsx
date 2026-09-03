"use client";

/**
 * MiniScene — the applicant island exterior. Composed from the member
 * world's own parts (TimeOfDayCycle, RoadTiles, Building, PlayerAvatar,
 * InstancedGLB, AmbientLife, the collectible systems) over the flat ground
 * and radial sea defined in lib/game/miniIsland.ts. One road, one
 * building, free roam over the grass: flowers to pick, trees to shake,
 * critters to catch, four fishing spots on the sand. The island is small
 * enough that everyone ends up at HQ.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { CameraControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import PlayerAvatar from "../PlayerAvatar";
import Building from "../Building";
import RoadTiles from "../RoadTiles";
import InstancedGLB, { type NaturePlacement } from "../InstancedNature";
import { GLBProp } from "../NatureModels";
import BlobShadows, { type BlobPlacement } from "../BlobShadows";
import AmbientLife from "../AmbientLife";
import Critters from "../Critters";
import TreeShakeFX from "../TreeShakeFX";
import FlowerPickFX from "../FlowerPickFX";
import FishCatchFX from "../FishCatchFX";
import { TargetGlow } from "../AmbienceFX";
import { TimeOfDayCycle } from "../TimeOfDayCycle";
import { subscribeFlowerPicks, getPickedSnapshot, getPickedServerSnapshot } from "@/lib/game/flowerPicks";
import { getActiveCritters } from "@/lib/game/critterStore";
import MiniTerrain from "./MiniTerrain";
import MiniOcean from "./MiniOcean";
import PathChevrons from "./PathChevrons";
import MiniSignpost from "./MiniSignpost";
import Seagulls from "./Seagulls";
import {
  MINI_SPAWN,
  HQ_POSITION,
  HQ_SIZE,
  ROAD_CONFIG,
  CHEVRONS,
  PORTAL_HOUR,
  miniHeight,
  clampToIsland,
} from "@/lib/game/miniIsland";

const FOG_COLOR = "#F2DCB8";
const INTERACT_RADIUS = 3.4;

export type MiniNearest =
  | { kind: "building"; id: string; name: string }
  | { kind: "tree"; id: string; name: string; treePos: [number, number]; species: number }
  | { kind: "flower"; id: string; name: string; flowerIdx: number; flowerPos: [number, number] }
  | { kind: "fishing"; id: string; name: string; spot: [number, number] }
  | { kind: "critter"; id: string; name: string; critterSlot: number };

// ─── Dressing (island coords; the road runs x∈[-1.75,1.75], z∈[-16.5,2.6]) ──

// Species order matches GameWorld's TREE_MODELS so TreeShakeFX drops the
// right thing (petals off the blossom, acorns off the cedar).
const TREE_MODELS = [
  "/assets/acnh/plants/tree-hardwood-a.glb",
  "/assets/acnh/plants/tree-hardwood-b.glb",
  "/assets/acnh/plants/tree-blossom.glb",
  "/assets/acnh/plants/tree-cedar.glb",
];
const TREES: [number, number][][] = [
  [[-8, -12], [8.5, -11], [-13, -5], [11, 9], [-6, 13.5], [16, -9]],
  [[12.5, -5.5], [-11, 8.5], [6.5, 13.5], [-16, -9.5], [9, -17.5]],
  [[-4.6, 11.5], [4.6, 11.5], [0, 15.5]],
  [[-14.5, 1.5], [14.5, 2], [-9.5, -18]],
];
/** Flat list for the E sweep and the critters' perch anchors; species = index into TREE_MODELS. */
const TREE_XZ: { xz: [number, number]; species: number }[] = TREES.flatMap((list, species) =>
  list.map((xz) => ({ xz, species }))
);
const TREE_ANCHORS: [number, number][] = TREE_XZ.map((t) => t.xz);

const BUSHES: { url: string; xz: [number, number][] }[] = [
  { url: "/assets/acnh/plants/bush-azalea.glb", xz: [[-4.6, -8.5], [4.6, -8.5], [-7, 4.2]] },
  { url: "/assets/acnh/plants/bush-hydrangea.glb", xz: [[-4.6, -3], [4.6, -3], [7, 4.2]] },
];

// Pickable flower clusters (the member world's system: 3 sub-flowers per
// cluster, species spread by seed, hidden once picked until respawn).
const FLOWER_XZ: [number, number][] = [
  [-3.4, -13.2], [3.6, -12.4], [-3.4, -5.8], [3.5, -6.4],
  [-6.2, 1.6], [6.2, 1.6], [-9, -8], [9.5, -6.5],
  [-10, 4], [10, 5], [-6, 8.5], [6.5, 8],
  [-13, -13], [13.5, -12], [-3, 17.5], [3, 17.5],
];
const FLOWER_MODELS = [
  "/assets/acnh/plants/flower-cosmos.glb",
  "/assets/acnh/plants/flower-lily.glb",
  "/assets/acnh/plants/flower-hyacinth.glb",
  "/assets/acnh/plants/flower-mum.glb",
  "/assets/acnh/plants/flower-rose.glb",
  "/assets/acnh/plants/flower-tulip.glb",
  "/assets/acnh/plants/flower-pansy.glb",
  "/assets/acnh/plants/flower-windflower.glb",
];
function buildFlowerPlacements(picked: readonly number[]): NaturePlacement[][] {
  const groups: NaturePlacement[][] = FLOWER_MODELS.map(() => []);
  const pickedSet = new Set(picked);
  FLOWER_XZ.forEach(([x, z], seed) => {
    if (pickedSet.has(seed)) return;
    const y = miniHeight(x, z);
    for (let j = 0; j < 3; j++) {
      const model = (seed + j) % FLOWER_MODELS.length;
      groups[model].push({
        position: [x + (j - 1) * 0.4, y, z + (((j * 7 + seed) % 3) - 1) * 0.3],
        rotation: j * 2.1,
        scale: 0.8,
      });
    }
  });
  return groups;
}

/** Cast spots on the sand ring, facing the water. */
const FISHING_SPOTS: [number, number][] = [[-14.9, -15.1], [15.1, -14.9], [-20.8, 4.6], [20.8, 4.6]];

const ROCKS: [number, number][] = [[-15.5, -12.5], [13.5, 11], [17, 4], [-19, 8.5]];
const LAMPS: [number, number][] = [[-3.7, 1.7], [3.7, 1.7]];
const SIGNPOST: [number, number, number] = [3.0, 0, -10.6];
const GULL_ANCHORS: [number, number][] = [[-17.5, -16.5], [18, 16.5]];

function placements(xz: [number, number][], seed: number, scaleBase = 0.95, scaleStep = 0.08): NaturePlacement[] {
  return xz.map(([x, z], i) => ({
    position: [x, miniHeight(x, z), z],
    rotation: ((i * 137 + seed) % 360) * (Math.PI / 180),
    scale: scaleBase + ((i + seed) % 4) * scaleStep,
  }));
}

const TREE_BLOBS: BlobPlacement[] = TREE_ANCHORS.map(([x, z]) => ({ x, y: miniHeight(x, z), z, rx: 1.4, rz: 1.1 }));

// Preload what this scene draws so the load gate covers it.
[
  ...TREE_MODELS,
  ...BUSHES.map((b) => b.url),
  ...FLOWER_MODELS,
  "/assets/acnh/props/streetlamp.glb",
  "/assets/acnh/props/rock-b.glb",
  "/assets/acnh/props/rock-d.glb",
].forEach((u) => useGLTF.preload(u));

/** The member world's streetlamp, lit: a warm globe + pool that ignores the hour. */
function LitLamp({ position }: { position: [number, number] }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <GLBProp url="/assets/acnh/props/streetlamp.glb" castShadow={false} />
      <mesh position={[0, 2.42, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshBasicMaterial color="#FFE4B0" toneMapped={false} />
      </mesh>
      <pointLight color="#FFD9A0" intensity={7} distance={7.5} decay={2} position={[0, 2.4, 0]} />
    </group>
  );
}

export default function MiniScene({
  playerName,
  spawn,
  frozen,
  playerPosRef,
  onMove,
  onNearest,
}: {
  playerName: string;
  spawn: [number, number, number] | undefined;
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onMove: (pos: THREE.Vector3) => void;
  onNearest: (n: MiniNearest | null) => void;
}) {
  const cameraRef = useRef<CameraControls>(null);
  const [playerPos, setPlayerPos] = useState(() => new THREE.Vector3(...(spawn ?? MINI_SPAWN)));
  const glowTargetRef = useRef<[number, number, number] | null>(null);
  const camFeel = useRef({ lastX: 0, lastZ: 0, lastT: 0, leadX: 0, leadZ: 0 });
  const nearestIdRef = useRef<string | null>(null);

  // Picked flower clusters hide until respawn (member world store).
  const picked = useSyncExternalStore(subscribeFlowerPicks, getPickedSnapshot, getPickedServerSnapshot);
  const flowerGroups = useMemo(() => buildFlowerPlacements(picked), [picked]);

  // Mouse buttons: left free (no click-to-move here), right drag looks, wheel zooms.
  useEffect(() => {
    const cc = cameraRef.current;
    if (!cc) return;
    cc.mouseButtons.left = 0;
    cc.mouseButtons.middle = 0;
    cc.mouseButtons.right = 1;
    cc.mouseButtons.wheel = 16;
  }, []);

  // Arrow keys rotate the camera (no-mouse fallback), same as the member world.
  const arrows = useRef({ left: false, right: false, up: false, down: false });
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (typing()) return;
      if (e.key === "ArrowLeft") arrows.current.left = true;
      else if (e.key === "ArrowRight") arrows.current.right = true;
      else if (e.key === "ArrowUp") arrows.current.up = true;
      else if (e.key === "ArrowDown") arrows.current.down = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") arrows.current.left = false;
      else if (e.key === "ArrowRight") arrows.current.right = false;
      else if (e.key === "ArrowUp") arrows.current.up = false;
      else if (e.key === "ArrowDown") arrows.current.down = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  useFrame(() => {
    const cc = cameraRef.current;
    if (!cc) return;
    const k = arrows.current;
    let dAz = 0;
    let dPol = 0;
    if (k.left) dAz -= 0.02;
    if (k.right) dAz += 0.02;
    if (k.up) dPol -= 0.015;
    if (k.down) dPol += 0.015;
    if (dAz !== 0 || dPol !== 0) cc.rotate(dAz, dPol, true);
  });

  // First frame: park the camera behind the spawn.
  useEffect(() => {
    const s = spawn ?? MINI_SPAWN;
    cameraRef.current?.setLookAt(s[0], 17, s[2] - 12, s[0], 1.5, s[2], false);
  }, [spawn]);

  const handlePlayerMove = useCallback(
    (position: THREE.Vector3) => {
      setPlayerPos(position);
      playerPosRef.current.copy(position);
      onMove(position);

      // Camera leads ~1.2u into the travel direction (member-world feel).
      const cf = camFeel.current;
      const now = performance.now();
      const dt = Math.min((now - cf.lastT) / 1000, 0.1) || 0.016;
      const vx = (position.x - cf.lastX) / dt;
      const vz = (position.z - cf.lastZ) / dt;
      cf.lastX = position.x;
      cf.lastZ = position.z;
      cf.lastT = now;
      const speed = Math.hypot(vx, vz);
      const lead = speed > 1 ? 1.2 : 0;
      const inv = speed > 0.001 ? 1 / speed : 0;
      cf.leadX = THREE.MathUtils.damp(cf.leadX, vx * inv * lead, 3, dt);
      cf.leadZ = THREE.MathUtils.damp(cf.leadZ, vz * inv * lead, 3, dt);
      cameraRef.current?.moveTo(position.x + cf.leadX, position.y + 1.5, position.z + cf.leadZ, true);

      // Nearest interactable, same priorities and radii as the member world.
      let bestDist = INTERACT_RADIUS;
      let best: MiniNearest | null = null;
      {
        const d = Math.hypot(HQ_POSITION[0] - position.x, HQ_POSITION[2] - position.z);
        if (d < bestDist) {
          bestDist = d;
          best = { kind: "building", id: "hq", name: "Tethos HQ" };
        }
      }
      for (let i = 0; i < FISHING_SPOTS.length; i++) {
        const [sx, sz] = FISHING_SPOTS[i];
        const d = Math.hypot(sx - position.x, sz - position.z);
        if (d < Math.min(bestDist, 2.4)) {
          bestDist = d;
          best = { kind: "fishing", id: `fish-${i}`, name: "Cast line", spot: [sx, sz] };
        }
      }
      const pickedNow = getPickedSnapshot();
      for (let i = 0; i < FLOWER_XZ.length; i++) {
        if (pickedNow.includes(i)) continue;
        const [fx, fz] = FLOWER_XZ[i];
        const d = Math.hypot(fx - position.x, fz - position.z);
        if (d < Math.min(bestDist, 2.0)) {
          bestDist = d;
          best = { kind: "flower", id: `flower-${i}`, name: "Pick flower", flowerIdx: i, flowerPos: [fx, fz] };
        }
      }
      for (const c of getActiveCritters()) {
        const d = Math.hypot(c.x - position.x, c.z - position.z);
        if (d < Math.min(bestDist, 2.2)) {
          bestDist = d;
          best = { kind: "critter", id: `critter-${c.slot}`, name: "Catch it!", critterSlot: c.slot };
        }
      }
      for (let i = 0; i < TREE_XZ.length; i++) {
        const [tx, tz] = TREE_XZ[i].xz;
        const d = Math.hypot(tx - position.x, tz - position.z);
        if (d < Math.min(bestDist, 2.6)) {
          bestDist = d;
          best = { kind: "tree", id: `tree-${i}`, name: "Shake tree", treePos: [tx, tz], species: TREE_XZ[i].species };
        }
      }

      let gp: [number, number, number] | null = null;
      if (best) {
        const xz =
          best.kind === "tree" ? best.treePos
          : best.kind === "flower" ? best.flowerPos
          : best.kind === "fishing" ? best.spot
          : best.kind === "building" ? [HQ_POSITION[0], HQ_POSITION[2] - 1.2] as [number, number]
          : null;
        if (xz) gp = [xz[0], miniHeight(xz[0], xz[1]), xz[1]];
      }
      glowTargetRef.current = gp;

      const id = best?.id ?? null;
      if (id !== nearestIdRef.current) {
        nearestIdRef.current = id;
        onNearest(best);
      }
    },
    [onMove, onNearest, playerPosRef]
  );

  const treeGroups = useMemo(() => TREES.map((xz, i) => ({ url: TREE_MODELS[i], list: placements(xz, i * 7, 0.92, 0.09) })), []);
  const bushGroups = useMemo(() => BUSHES.map((b, i) => ({ url: b.url, list: placements(b.xz, i * 11, 0.9, 0.1) })), []);

  return (
    <>
      <CameraControls
        ref={cameraRef}
        minPolarAngle={Math.PI / 2 - (42 * Math.PI) / 180}
        maxPolarAngle={Math.PI / 2}
        minDistance={10}
        maxDistance={26}
        dollySpeed={1.0}
        truckSpeed={0}
        smoothTime={0.18}
        draggingSmoothTime={0.05}
        azimuthRotateSpeed={1.0}
        polarRotateSpeed={0.6}
        makeDefault
      />

      {/* No shadow map: the low sun raked self-shadows across the canopies
          and the trees read as half drawn. Blob shadows ground everything. */}
      <TimeOfDayCycle weather="sunny" todPhase="day" shadowsOn={false} playerPosRef={playerPosRef} hourOverride={PORTAL_HOUR} />
      <fog attach="fog" args={[FOG_COLOR, 30, 72]} />

      <MiniTerrain />
      <MiniOcean />
      <RoadTiles config={ROAD_CONFIG} />
      <PathChevrons points={CHEVRONS} heightAt={miniHeight} />

      <Building
        id="hq"
        name="Tethos HQ"
        position={HQ_POSITION}
        size={HQ_SIZE}
        color="#FFF5E1"
        roofColor="#E87B5A"
        interior="office"
        showLabel={false}
        playerPosition={playerPos}
      />
      <MiniSignpost position={SIGNPOST} target={[HQ_POSITION[0], HQ_POSITION[2]]} />
      {LAMPS.map((p) => (
        <LitLamp key={`lamp-${p[0]}`} position={p} />
      ))}
      {ROCKS.map(([x, z], i) => (
        <GLBProp
          key={`rock-${i}`}
          url={i % 2 ? "/assets/acnh/props/rock-b.glb" : "/assets/acnh/props/rock-d.glb"}
          position={[x, miniHeight(x, z), z]}
          rotation={[0, i * 1.3, 0]}
          castShadow={false}
        />
      ))}

      {treeGroups.map((g) => (
        <InstancedGLB key={g.url} url={g.url} placements={g.list} castShadow={false} receiveShadow={false} />
      ))}
      {bushGroups.map((g) => (
        <InstancedGLB key={g.url} url={g.url} placements={g.list} castShadow={false} receiveShadow={false} />
      ))}
      {flowerGroups.map((list, i) =>
        list.length ? (
          <InstancedGLB key={FLOWER_MODELS[i]} url={FLOWER_MODELS[i]} placements={list} castShadow={false} receiveShadow={false} />
        ) : null
      )}
      <BlobShadows placements={TREE_BLOBS} opacity={0.22} />

      <AmbientLife phase="day" density={0.6} />
      <Seagulls anchors={GULL_ANCHORS} />
      <Critters todPhase="day" playerPosRef={playerPosRef} flowerAnchors={FLOWER_XZ} treeAnchors={TREE_ANCHORS} heightAt={miniHeight} />
      <TreeShakeFX playerPosRef={playerPosRef} />
      <FlowerPickFX />
      <FishCatchFX playerPosRef={playerPosRef} />
      <TargetGlow targetRef={glowTargetRef} />

      <PlayerAvatar
        spawnPosition={spawn ?? MINI_SPAWN}
        onMove={handlePlayerMove}
        playerName={playerName}
        playerLevel={1}
        heightAt={miniHeight}
        clampAt={clampToIsland}
        clickToMove={false}
        frozen={frozen}
        showNameplate={false}
      />
    </>
  );
}
