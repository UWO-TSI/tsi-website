"use client";

/**
 * Development only (specs/perf/): what each frame costs, for the perf bench (specs/perf/perf-bench.mjs) on
 * `window.__perf`. Between `begin()` and `end()` it records, per frame: draw calls and triangles (every pass: the shadow
 * maps, the scene, the post passes), character mixers stepped and skeletons uploaded (lib/game/perf/frameStats.ts), the
 * main thread's time from the first frame callback to the end of the scene render (`cpu`) and of the render alone
 * (`render`). `scene()` counts what the scene holds. Nothing runs in production.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frameStats } from "@/lib/game/perf/frameStats";

const CAP = 8192;
const FIELDS = ["calls", "triangles", "mixers", "skeletons", "cpu", "render", "scenes"] as const;
type Field = (typeof FIELDS)[number];

class Recorder {
  on = false;
  n = 0;
  readonly rows = Object.fromEntries(FIELDS.map(f => [f, new Float32Array(CAP)])) as Record<Field, Float32Array>;
  start = -1;
  before = -1;
  after = -1;
  /** Scene renders this frame (the composer's, and any pass that draws the scene again), and who asked, when `trace` is on. */
  scenes = 0;
  trace = false;
  readonly callers: string[] = [];
  /** The frame that just ended (read at the start of the next, before the world's Performance probe resets gl.info). */
  close(info: THREE.WebGLInfo) {
    if (this.on && this.start >= 0 && this.after >= this.start && this.n < CAP) {
      const r = this.rows, i = this.n++;
      r.calls[i] = info.render.calls; r.triangles[i] = info.render.triangles;
      r.mixers[i] = frameStats.mixers; r.skeletons[i] = frameStats.skeletons;
      r.cpu[i] = this.after - this.start; r.render[i] = this.before >= 0 ? this.after - this.before : 0; r.scenes[i] = this.scenes;
    }
    this.scenes = 0;
    frameStats.mixers = 0; frameStats.skeletons = 0;
    this.start = performance.now(); this.before = -1; this.after = -1;
  }
  summary() {
    const out: Record<string, { median: number; p95: number; max: number; mean: number }> = {};
    for (const f of FIELDS) {
      const a = Array.from(this.rows[f].subarray(0, this.n)).sort((x, y) => x - y);
      const q = (p: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0);
      out[f] = { median: q(0.5), p95: q(0.95), max: a.at(-1) ?? 0, mean: a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0 };
    }
    return { frames: this.n, ...out };
  }
}

let counting = false;
/** Count skeleton uploads (WebGLObjects calls Skeleton.update once per drawn skeleton a render). */
function countSkeletons() {
  if (counting) return;
  counting = true;
  const update = THREE.Skeleton.prototype.update;
  THREE.Skeleton.prototype.update = function (this: THREE.Skeleton) { frameStats.skeletons++; update.call(this); };
}

/** What the scene holds now: meshes by kind (shown, i.e. every ancestor visible), lights, programs, GPU memory. */
function sceneCounts(scene: THREE.Scene, gl: THREE.WebGLRenderer) {
  const c = { skinned: 0, instanced: 0, instances: 0, meshes: 0, points: 0, sprites: 0, lights: 0, casters: 0, objects: 0 };
  scene.traverseVisible(o => {
    c.objects++;
    const m = o as THREE.Mesh;
    if ((o as THREE.Light).isLight) c.lights++;
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) c.skinned++;
    else if ((o as THREE.InstancedMesh).isInstancedMesh) { c.instanced++; c.instances += (o as THREE.InstancedMesh).count; }
    else if (m.isMesh) c.meshes++;
    else if ((o as THREE.Points).isPoints) c.points++;
    else if ((o as THREE.Sprite).isSprite) c.sprites++;
    if (m.isMesh && m.castShadow) c.casters++;
  });
  return { ...c, programs: gl.info.programs?.length ?? 0, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
}

/** Time the scene's render and put the recorder on the window; returns the undo (module scope: hook values are never written in a component). */
function attach(rec: Recorder, scene: THREE.Scene, gl: THREE.WebGLRenderer) {
  countSkeletons();
  const before = scene.onBeforeRender, after = scene.onAfterRender;
  scene.onBeforeRender = (...args) => {
    if (rec.before < 0) rec.before = performance.now();
    rec.scenes++;
    if (rec.trace) rec.callers.push(new Error().stack?.split("\n").slice(2, 9).join(" < ") ?? "");
    before.apply(scene, args);
  };
  scene.onAfterRender = (...args) => { after.apply(scene, args); rec.after = performance.now(); };
  Object.assign(window, { __perf: {
    begin: () => { rec.n = 0; rec.on = true; },
    end: () => { rec.on = false; return rec.summary(); },
    scene: () => sceneCounts(scene, gl),
    /** Who renders the scene, over the next `frames` frames (call stacks). */
    callers: (frames = 1) => new Promise<string[]>(done => {
      rec.callers.length = 0; rec.trace = true;
      let left = frames + 1;
      const tick = () => { if (--left > 0) requestAnimationFrame(tick); else { rec.trace = false; done([...rec.callers]); } };
      requestAnimationFrame(tick);
    }),
  } });
  return () => { scene.onBeforeRender = before; scene.onAfterRender = after; delete (window as { __perf?: unknown }).__perf; };
}

export default function PerfProbe() {
  const gl = useThree(s => s.gl), scene = useThree(s => s.scene);
  const rec = useMemo(() => new Recorder(), []);
  useEffect(() => attach(rec, scene, gl), [gl, scene, rec]);
  // First of all the frame's callbacks (the world's Performance probe resets gl.info at -100).
  useFrame(({ gl }) => rec.close(gl.info), -1000);
  return null;
}
