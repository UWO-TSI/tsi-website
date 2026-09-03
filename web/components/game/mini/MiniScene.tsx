"use client";

/**
 * MiniScene — the applicant island exterior. Composed from the member
 * world's own parts (TimeOfDayCycle, RoadTiles, Building, PlayerAvatar,
 * InstancedGLB, AmbientLife, BlobShadows) over the flat ground and radial
 * sea defined in lib/game/miniIsland.ts. One road, one building.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TargetGlow } from "../AmbienceFX";
import { TimeOfDayCycle } from "../TimeOfDayCycle";
import MiniTerrain from "./MiniTerrain";
import MiniOcean from "./MiniOcean";
import PathChevrons from "./PathChevrons";
import MiniSignpost from "./MiniSignpost";
import {
  MINI_SPAWN,
  HQ_POSITION,
  HQ_SIZE,
  ROAD_CONFIG,
  CHEVRONS,
  miniHeight,
  clampToRoad,
} from "@/lib/game/miniIsland";

/** Pinned late afternoon: warm key, long shadows, still bright. */
const PORTAL_HOUR = 16.3;
const FOG_COLOR = "#F2DCB8";
const INTERACT_RADIUS = 3.4;

export interface MiniNearest {
  kind: "building";
  id: string;
  name: string;
}

// ─── Dressing (island coords; the road runs x∈[-1.75,1.75], z∈[-16.5,2.6]) ──

const TREES: { url: string; xz: [number, number][] }[] = [
  {
    url: "/assets/acnh/plants/tree-hardwood-a.glb",
    xz: [[-8, -12], [8.5, -11], [-13, -5], [11, 9], [-6, 13.5], [16, -9]],
  },
  {
    url: "/assets/acnh/plants/tree-hardwood-b.glb",
    xz: [[12.5, -5.5], [-11, 8.5], [6.5, 13.5], [-16, -9.5], [9, -17.5]],
  },
  {
    url: "/assets/acnh/plants/tree-cedar.glb",
    xz: [[-14.5, 1.5], [14.5, 2], [-9.5, -18]],
  },
  {
    url: "/assets/acnh/plants/tree-blossom.glb",
    xz: [[-4.6, 11.5], [4.6, 11.5], [0, 15.5]],
  },
];

const BUSHES: { url: string; xz: [number, number][] }[] = [
  { url: "/assets/acnh/plants/bush-azalea.glb", xz: [[-4.6, -8.5], [4.6, -8.5], [-7, 4.2]] },
  { url: "/assets/acnh/plants/bush-hydrangea.glb", xz: [[-4.6, -3], [4.6, -3], [7, 4.2]] },
];

const FLOWERS: { url: string; xz: [number, number][] }[] = [
  { url: "/assets/acnh/plants/flower-cosmos.glb", xz: [[-3.3, -13.2], [3.4, -12.6], [-5.6, 1.4]] },
  { url: "/assets/acnh/plants/flower-tulip.glb", xz: [[-3.4, -5.6], [3.3, -6.2], [5.6, 1.4]] },
  { url: "/assets/acnh/plants/flower-pansy.glb", xz: [[-3.2, -10], [3.3, -9.4]] },
];

const ROCKS: [number, number][] = [[-15.5, -12.5], [13.5, 11], [17, 4]];

const LAMPS: [number, number][] = [[-3.7, 1.7], [3.7, 1.7]];

const SIGNPOST: [number, number, number] = [3.0, 0, -10.6];

// Fence rows either side of the road (1u segments along z → rot π/2).
const FENCES: NaturePlacement[] = (() => {
  const out: NaturePlacement[] = [];
  for (const x of [-2.75, 2.75]) {
    for (let z = -15.5; z <= -0.5; z += 1) {
      out.push({ position: [x, 0, z], rotation: Math.PI / 2 });
    }
  }
  return out;
})();

function placements(xz: [number, number][], seed: number, scaleBase = 0.95, scaleStep = 0.08): NaturePlacement[] {
  return xz.map(([x, z], i) => ({
    position: [x, miniHeight(x, z), z],
    rotation: ((i * 137 + seed) % 360) * (Math.PI / 180),
    scale: scaleBase + ((i + seed) % 4) * scaleStep,
  }));
}

const TREE_BLOBS: BlobPlacement[] = TREES.flatMap((t) =>
  t.xz.map(([x, z]) => ({ x, y: miniHeight(x, z), z, rx: 1.4, rz: 1.1 }))
);

// Preload what this scene draws so the load gate covers it.
[
  ...TREES.map((t) => t.url),
  ...BUSHES.map((b) => b.url),
  ...FLOWERS.map((f) => f.url),
  "/assets/acnh/props/fence-log-a.glb",
  "/assets/acnh/props/streetlamp.glb",
  "/assets/acnh/props/rock-b.glb",
  "/assets/acnh/props/rock-d.glb",
].forEach((u) => useGLTF.preload(u));

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

      // The only interactable outside is the HQ door.
      const d = Math.hypot(HQ_POSITION[0] - position.x, HQ_POSITION[2] - position.z);
      const near = d < INTERACT_RADIUS;
      const id = near ? "hq" : null;
      glowTargetRef.current = near ? [HQ_POSITION[0], 0, HQ_POSITION[2] - 1.2] : null;
      if (id !== nearestIdRef.current) {
        nearestIdRef.current = id;
        onNearest(near ? { kind: "building", id: "hq", name: "Tethos HQ" } : null);
      }
    },
    [onMove, onNearest, playerPosRef]
  );

  const treeGroups = useMemo(() => TREES.map((t, i) => ({ url: t.url, list: placements(t.xz, i * 7, 0.92, 0.09) })), []);
  const bushGroups = useMemo(() => BUSHES.map((b, i) => ({ url: b.url, list: placements(b.xz, i * 11, 0.9, 0.1) })), []);
  const flowerGroups = useMemo(() => FLOWERS.map((f, i) => ({ url: f.url, list: placements(f.xz, i * 5, 0.85, 0.05) })), []);

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

      <TimeOfDayCycle weather="sunny" todPhase="day" shadowsOn playerPosRef={playerPosRef} hourOverride={PORTAL_HOUR} />
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
        playerPosition={playerPos}
      />
      <MiniSignpost position={SIGNPOST} target={[HQ_POSITION[0], HQ_POSITION[2]]} label="Tethos HQ" />
      {LAMPS.map(([x, z]) => (
        <GLBProp key={`lamp-${x}`} url="/assets/acnh/props/streetlamp.glb" position={[x, 0, z]} />
      ))}
      <InstancedGLB url="/assets/acnh/props/fence-log-a.glb" placements={FENCES} castShadow={false} />
      {ROCKS.map(([x, z], i) => (
        <GLBProp
          key={`rock-${i}`}
          url={i % 2 ? "/assets/acnh/props/rock-b.glb" : "/assets/acnh/props/rock-d.glb"}
          position={[x, miniHeight(x, z), z]}
          rotation={[0, i * 1.3, 0]}
        />
      ))}

      {treeGroups.map((g) => (
        <InstancedGLB key={g.url} url={g.url} placements={g.list} />
      ))}
      {bushGroups.map((g) => (
        <InstancedGLB key={g.url} url={g.url} placements={g.list} castShadow={false} />
      ))}
      {flowerGroups.map((g) => (
        <InstancedGLB key={g.url} url={g.url} placements={g.list} castShadow={false} />
      ))}
      <BlobShadows placements={TREE_BLOBS} opacity={0.22} />

      <AmbientLife phase="day" density={0.6} />
      <TargetGlow targetRef={glowTargetRef} />

      <PlayerAvatar
        spawnPosition={spawn ?? MINI_SPAWN}
        onMove={handlePlayerMove}
        playerName={playerName}
        playerLevel={1}
        heightAt={miniHeight}
        clampAt={clampToRoad}
        clickToMove={false}
        frozen={frozen}
        showNameplate={false}
      />
    </>
  );
}
