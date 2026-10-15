"use client";

/**
 * The world editor's 3D view (specs/world-editor.md v0 step 5): Minecraft creative-mode flight (WASD, Space up, Shift
 * down, Q faster (Ctrl+W would close the tab), the mouse looking under pointer lock), the crosshair's ray onto the ground, the brush ring (or the
 * cell square) drawn on it, the terrain as the game draws it (SmoothTerrain, its water and its grass), the open sea,
 * the objects and the placement ghost. A held button's stroke runs here every frame (editorStore.strokeFrame), so the
 * ground changes under the brush while you hold it; only the touched chunks are rewritten.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ISLAND_LIGHTING } from "@/lib/game/islandLighting";
import type { IslandMap } from "@/lib/game/grid";
import { objectFootprint } from "@/lib/game/defaultIsland";
import { snapPlacement } from "@/lib/game/painterTools";
import { cellAt, cellSquare } from "@/lib/game/world/brushes";
import { idFor } from "@/lib/game/world/editorTools";
import { rayTerrain } from "@/lib/game/world/raycast";
import { terrainHeight, type WorldTerrain } from "@/lib/game/world/terrain";
import type { MapObject } from "@/lib/game/villageMap";
import GridOcean from "../../grid/GridOcean";
import { useWaterFrame } from "../../grid/GridWorld";
import SmoothTerrain from "../SmoothTerrain";
import type { TerrainView } from "../terrainView";
import EditorObjects from "./EditorObjects";
import { bump, ed, item, selectedObject, strokeFrame, useEditor } from "./editorStore";

/** Held keys and the mouse's movement since the last frame (the page's listeners fill them). */
export const input = { keys: new Set<string>(), dx: 0, dy: 0 };
/** The fly camera's pose; the overhead view's. */
export const pose = { x: 52, y: 18, z: 40, yaw: 2.2, pitch: -0.42, over: { x: 20, z: 40, h: 160 } };

const LIGHT = ISLAND_LIGHTING.day;
/** The worst frame and the worst editing work in the last second (ms), and the grass's refill clock. */
const timing = { frame: 0, edit: 0, grass: 0 };
const SPEED = 14, SENSITIVITY = 0.0022;
const _dir = new THREE.Vector3();

function Controller() {
  const { camera, gl } = useThree();
  const stats = useRef({ t: 0, frames: 0 });
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1), t = ed.world?.terrain;
    if (!t) return;
    const k = input.keys, fast = k.has("q") ? 3 : 1;
    // Fly (or pan the overhead view).
    if (ed.overhead) {
      const v = SPEED * fast * Math.max(1, pose.over.h / 40) * dt;
      if (k.has("w")) pose.over.z -= v;
      if (k.has("s")) pose.over.z += v;
      if (k.has("a")) pose.over.x -= v;
      if (k.has("d")) pose.over.x += v;
      if (k.has(" ")) pose.over.h = Math.min(500, pose.over.h + v);
      if (k.has("Shift")) pose.over.h = Math.max(20, pose.over.h - v);
      camera.position.set(pose.over.x, pose.over.h, pose.over.z);
      camera.rotation.set(-Math.PI / 2, 0, 0, "YXZ");
      input.dx = 0; input.dy = 0;
    } else {
      if (ed.locked) {
        pose.yaw -= input.dx * SENSITIVITY;
        pose.pitch = Math.max(-1.55, Math.min(1.55, pose.pitch - input.dy * SENSITIVITY));
      }
      input.dx = 0; input.dy = 0;
      const v = SPEED * fast * dt, fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw), rx = Math.cos(pose.yaw), rz = -Math.sin(pose.yaw);
      if (k.has("w")) { pose.x += fx * v; pose.z += fz * v; }
      if (k.has("s")) { pose.x -= fx * v; pose.z -= fz * v; }
      if (k.has("d")) { pose.x += rx * v; pose.z += rz * v; }
      if (k.has("a")) { pose.x -= rx * v; pose.z -= rz * v; }
      if (k.has(" ")) pose.y += v;
      if (k.has("Shift")) pose.y -= v;
      pose.y = Math.max(pose.y, Math.max(terrainHeight(t, pose.x, pose.z), t.seaLevel) + 0.8);
      camera.position.set(pose.x, pose.y, pose.z);
      camera.rotation.set(pose.pitch, pose.yaw, 0, "YXZ");
    }
    camera.updateMatrixWorld();
    ed.camera.x = camera.position.x; ed.camera.y = camera.position.y; ed.camera.z = camera.position.z;
    // The crosshair: the ground (or, placing and selecting, the water's surface) at the middle of the view.
    camera.getWorldDirection(_dir);
    const it = item(), onWater = it.type === "place" || it.type === "select";
    ed.hit = rayTerrain(t, camera.position.x, camera.position.y, camera.position.z, _dir.x, _dir.y, _dir.z, 800, onWater);
    if (ed.stroke) {
      const t0 = performance.now();
      strokeFrame(dt);
      // The brush's work this frame and the view's rewrite of what it touched (last frame's), for the HUD.
      timing.edit = Math.max(timing.edit, performance.now() - t0 + (ed.view?.lastMs ?? 0));
      // The blades follow the ground a few times a second while you hold the button.
      if ((timing.grass += dt) > 0.25) { timing.grass = 0; ed.grassRevision++; }
    }
    timing.frame = Math.max(timing.frame, raw * 1000);
    // The HUD's numbers, once a second.
    const s = stats.current;
    s.t += raw; s.frames++;
    if (s.t >= 1) {
      const v = ed.view?.stats();
      ed.stats = { fps: Math.round(s.frames / s.t), draws: gl.info.render.calls, triangles: gl.info.render.triangles, chunks: v?.chunks ?? 0, lods: v?.lods ?? [0, 0, 0, 0],
        frameMs: Math.round(timing.frame * 10) / 10, editMs: Math.round(timing.edit * 100) / 100 };
      s.t = 0; s.frames = 0; timing.frame = 0; timing.edit = 0;
      bump();
    }
  }, -1);
  return null;
}

/** Lay the cursor on the ground at the crosshair (module scope: hook values are never written in a component). */
function drawCursor(line: THREE.LineLoop) {
  const t = ed.world?.terrain, hit = ed.hit, it = item();
  const p = line.geometry.getAttribute("position") as THREE.BufferAttribute, a = p.array as Float32Array;
  line.visible = !!t && !!hit && it.type !== "place" && it.type !== "select";
  if (!line.visible || !t || !hit) return;
  const cellMode = ed.mode === "cell" && (it.type === "paint" || (it.type === "brush" && ["raise", "lower", "flatten", "level"].includes(it.tool)));
  const color = it.type === "paint" ? "#ffd166" : it.type === "road" ? "#e0a060" : it.type === "brush" && (it.tool === "lower") ? "#ff8f6a" : "#ffffff";
  (line.material as THREE.LineBasicMaterial).color.set(color);
  const put = (j: number, x: number, z: number) => { a[j * 3] = x; a[j * 3 + 1] = Math.max(terrainHeight(t, x, z), t.seaLevel) + 0.08; a[j * 3 + 2] = z; };
  if (cellMode) {
    const [cx, cz] = cellAt(t, hit.x, hit.z), sq = cellSquare(t, cx, cz, ed.cellN);
    const x0 = t.originX + sq.cx0 - 0.5, x1 = t.originX + sq.cx1 + 0.5, z0 = t.originZ + sq.cz0 - 0.5, z1 = t.originZ + sq.cz1 + 0.5;
    for (let j = 0; j < 129; j++) {
      const side = Math.min(3, Math.floor(j / 32)), u = (j - side * 32) / 32;
      const [x, z] = side === 0 ? [x0 + (x1 - x0) * u, z0] : side === 1 ? [x1, z0 + (z1 - z0) * u] : side === 2 ? [x1 - (x1 - x0) * u, z1] : [x0, z1 - (z1 - z0) * Math.min(1, u)];
      put(j, x, z);
    }
  } else {
    const r = it.type === "road" ? 1.2 : ed.radius;
    for (let j = 0; j < 129; j++) { const a2 = (j / 128) * Math.PI * 2; put(j, hit.x + Math.cos(a2) * r, hit.z + Math.sin(a2) * r); }
  }
  p.needsUpdate = true;
}

/** The brush ring (or the cell square) laid on the ground at the crosshair. */
function Cursor() {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(129 * 3), 3));
    const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: "#ffffff", depthTest: false, transparent: true, opacity: 0.9 }));
    l.renderOrder = 30;
    l.frustumCulled = false;
    return l;
  }, []);
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose(); }, [line]);
  useFrame(() => drawCursor(line));
  return <primitive object={line} />;
}

/** The placement ghost and the selection, redrawn when the HUD's version moves (the crosshair moves it each frame). */
function Objects({ terrain }: { terrain: WorldTerrain }) {
  useEditor();
  const it = item(), hit = ed.hit;
  let ghost: { o: MapObject; building: boolean } | null = null;
  if (it.type === "place" && hit) {
    const probe = { id: idFor(it, ed.objects), kind: it.object.kind, x: 0, z: 0, ...(it.object.model ? { model: it.object.model } : {}), yaw: ed.ghostYaw,
      ...(it.object.kind === "landmark" && it.building ? { scale: 1.15 } : {}) } as MapObject;
    const f = it.building ? objectFootprint(probe) : null;
    const [x, z] = f ? snapPlacement(hit.x, hit.z, 0, [f.hw, f.hd]) : snapPlacement(hit.x, hit.z, 0.5);
    ghost = { o: { ...probe, x, z }, building: !!it.building };
  }
  return <EditorObjects terrain={terrain} objects={ed.objects} light={LIGHT} ghost={ghost} selected={selectedObject()} />;
}

/** Re-render the ghost as the crosshair moves (a few times a second is enough for a preview). */
function GhostTicker() {
  const last = useRef("");
  useFrame(() => {
    const it = item();
    if (it.type !== "place" || !ed.hit) return;
    const key = `${Math.round(ed.hit.x * 2)}:${Math.round(ed.hit.z * 2)}:${ed.ghostYaw}`;
    if (key !== last.current) { last.current = key; bump(); }
  });
  return null;
}

function Scene({ terrain, ocean }: { terrain: WorldTerrain; ocean: IslandMap }) {
  useEditor();
  useWaterFrame(LIGHT, false, "waves");
  const onView = useCallback((v: TerrainView | null) => { ed.view = v; if (v) v.forceLod = null; }, []);
  // No blades under a building or a trunk.
  const objects = ed.objects;
  const clear = useMemo(() => {
    return (x: number, z: number) => !objects.some(o => {
      const f = objectFootprint(o);
      if (!f) return o.kind === "tree" && Math.hypot(x - o.x, z - o.z) < 0.65;
      const yaw = o.yaw ?? 0, dx = x - o.x, dz = z - o.z;
      return Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw) - f.cx) < f.hw && Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw) - f.cz) < f.hd;
    });
  }, [objects]);
  return <>
    <color attach="background" args={[LIGHT.sky]} />
    <fog attach="fog" args={[LIGHT.fogColor, 90, 520]} />
    <hemisphereLight args={[LIGHT.sky, LIGHT.bounce, LIGHT.hemisphere]} />
    <ambientLight color={LIGHT.fill} intensity={LIGHT.ambient} />
    <directionalLight color={LIGHT.sun} intensity={LIGHT.sunIntensity} position={LIGHT.sunPosition} />
    <SmoothTerrain terrain={terrain} shore={ed.shore ?? undefined} onView={onView} revision={ed.grassRevision} clear={clear} grassOn={!ed.overhead} />
    <GridOcean map={ocean} lite={false} waves />
    <Objects terrain={terrain} />
    <Cursor />
    <GhostTicker />
    <Controller />
  </>;
}

export default function EditorCanvas({ terrain, ocean, onCanvas }: { terrain: WorldTerrain; ocean: IslandMap; onCanvas: (el: HTMLCanvasElement) => void }) {
  return <Canvas camera={{ fov: 62, near: 0.1, far: 2500, position: [pose.x, pose.y, pose.z] }} dpr={[1, 1.5]} gl={{ antialias: true }}
    onCreated={({ gl }) => onCanvas(gl.domElement)} style={{ position: "absolute", inset: 0 }}>
    <Scene terrain={terrain} ocean={ocean} />
  </Canvas>;
}
