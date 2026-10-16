"use client";

/**
 * Development only (specs/perf/): what each frame costs, for the perf bench (specs/perf/perf-bench.mjs) on
 * `window.__perf`. Between `begin()` and `end()` it records, per frame: draw calls and triangles (every pass: the shadow
 * maps, the scene, the post passes), character mixers stepped and skeletons uploaded (lib/game/perf/frameStats.ts), the
 * main thread's time from the first frame callback to the end of the scene render (`cpu`) and of the render alone
 * (`render`). `scene()` counts what the scene holds. Where the browser has EXT_disjoint_timer_query_webgl2 it also
 * times the GPU's work for each whole frame (`gpu()`: every GL command between two frames' first callbacks; most
 * desktop Chromes hide the extension, and then it reports nothing). Nothing runs in production.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frameStats } from "@/lib/game/perf/frameStats";

const CAP = 8192;
const FIELDS = ["calls", "triangles", "mixers", "skeletons", "cpu", "render", "scenes", "lodMeshes", "throttled", "fullMeshes", "lod2Meshes"] as const;
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
      r.mixers[i] = frameStats.mixers; r.skeletons[i] = frameStats.skeletons; r.lodMeshes[i] = frameStats.lodMeshes; r.throttled[i] = frameStats.throttled;
      r.fullMeshes[i] = frameStats.fullMeshes; r.lod2Meshes[i] = frameStats.lod2Meshes;
      r.cpu[i] = this.after - this.start; r.render[i] = this.before >= 0 ? this.after - this.before : 0; r.scenes[i] = this.scenes;
    }
    this.scenes = 0;
    frameStats.mixers = 0; frameStats.skeletons = 0; frameStats.lodMeshes = 0; frameStats.throttled = 0; frameStats.fullMeshes = 0; frameStats.lod2Meshes = 0;
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

/** GPU time per frame from timer queries (EXT_disjoint_timer_query_webgl2), when the browser exposes it. */
interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
class GpuTimer {
  private readonly ext: TimerExt | null;
  private active: WebGLQuery | null = null;
  private readonly pending: WebGLQuery[] = [];
  readonly ms: number[] = [];
  on = false;
  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  }
  get available() { return !!this.ext; }
  /** At each frame's start: close the last frame's query, open this one's, collect what has finished. */
  frame() {
    const { gl, ext } = this;
    if (!ext) return;
    if (this.active) { gl.endQuery(ext.TIME_ELAPSED_EXT); this.pending.push(this.active); this.active = null; }
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = this.pending.shift()!, ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (this.on && !gl.getParameter(ext.GPU_DISJOINT_EXT)) this.ms.push(ns / 1e6);
      gl.deleteQuery(q);
    }
    if (this.on && this.pending.length < 8) { this.active = gl.createQuery(); if (this.active) gl.beginQuery(ext.TIME_ELAPSED_EXT, this.active); }
  }
  summary() {
    const a = [...this.ms].sort((x, y) => x - y), q = (p: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0);
    return { available: this.available, frames: a.length, median: q(0.5), p95: q(0.95), mean: a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0 };
  }
}

/** Time the scene's render and put the recorder on the window; returns the undo (module scope: hook values are never written in a component). */
function attach(rec: Recorder, scene: THREE.Scene, gl: THREE.WebGLRenderer, gpu: GpuTimer) {
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
    begin: () => { rec.n = 0; rec.on = true; gpu.ms.length = 0; gpu.on = true; },
    end: () => { rec.on = false; gpu.on = false; return { ...rec.summary(), gpu: gpu.summary() }; },
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
  const gpu = useMemo(() => new GpuTimer(gl.getContext() as WebGL2RenderingContext), [gl]);
  useEffect(() => attach(rec, scene, gl, gpu), [gl, scene, rec, gpu]);
  // First of all the frame's callbacks (the world's Performance probe resets gl.info at -100).
  useFrame(({ gl }) => { rec.close(gl.info); gpu.frame(); }, -1000);
  return null;
}
