"use client";

/**
 * /lab/fx: the VFX library's previews (lib/game/fx/library.ts, specs/vfx-library.md), one type at a time
 * (?type=<kind>; David 2026-11-06: "show me one by one the animation"): large, on a plain rod and a sword moving as a hand
 * moves them (the types are holder-agnostic), drawn by the game's own code (HolderFx), its strength rising from 1 to
 * 2.5 and back every few seconds so what grows shows. ?k=<n> holds one strength. The lightning strike (?type=lightning)
 * plays every few seconds, the holders freezing on its hit. The index lists the two families, auras and effects.
 * ?study=tidewarden draws the Tidewarden at its reference's own size and framing.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import RodAura, { rodFxUrl } from "@/components/game/character/RodAura";
import HolderFx from "@/components/game/fx/HolderFx";
import { FX, fxAt, type FxKind } from "@/lib/game/fx/library";
import type { StrikeKind } from "@/lib/game/fx/holder";

/** Each study's reference: its size, its paper, px per unit, where the thing's origin is (px) and its lean (degrees). */
const STUDY = {
  // the trident's frame from art/pipeline/traced_refs.py (TIDEWARDEN frame): its hand, its px per rig unit, its lean
  // (the rod's head faces its holder's side, a quarter turn about the shaft: `face` turns it back to you)
  tidewarden: { w: 1012, h: 1798, bg: "#F6F6F6", ppu: 1726.8, at: [817, 1588.6], lean: 23.91, face: -Math.PI / 2 },
} as const;

function Trident({ k }: { k: number }) {
  const { scene } = useGLTF("/assets/game/tools/rod-5.glb");
  const rod = useMemo(() => scene.clone(true), [scene]), fx = rodFxUrl(rod);
  return <><primitive object={rod} />{fx && <RodAura rod={rod} url={fx} strength={k} />}</>;
}

/** A study drawn as its reference is framed: flat to you, the same size, on its paper. */
function Study({ k, of }: { k: number; of: keyof typeof STUDY }) {
  const f = STUDY[of], at = [(f.w / 2 - f.at[0]) / f.ppu, (f.at[1] - f.h / 2) / f.ppu] as const;
  return <div style={{ position: "fixed", left: 0, top: 0, zIndex: 100000, width: f.w, height: f.h, background: f.bg }} data-testid="fx-study">
    <Canvas orthographic flat dpr={1} camera={{ zoom: f.ppu, position: [at[0], at[1], 5] }} onCreated={({ camera }) => camera.lookAt(at[0], at[1], 0)} gl={{ antialias: true }}>
      <ambientLight intensity={1.3} /><directionalLight position={[-1, 2, 3]} intensity={1.2} />
      <group rotation={[0, 0, (f.lean * Math.PI) / 180]}><group rotation={[0, f.face, 0]}><Suspense fallback={null}><Trident k={k} /></Suspense></group></group>
    </Canvas>
  </div>;
}

/** A solo view's holders: a plain rod and a sword (the library is holder-agnostic), each fit to `H` tall from its foot. */
const HOLDERS = ["/assets/game/tools/rod-1.glb", "/assets/game/weapons/sword-iron.glb"], H = 1.6;
function Holder({ url, x, kind, k, once, strike }: { url: string; x: number; kind: Solo; k: number; once: number; strike: number }) {
  const { scene } = useGLTF(url);
  const holder = useMemo(() => {
    const m = scene.clone(true), box = new THREE.Box3().setFromObject(m), dim = box.getSize(new THREE.Vector3()), s = H / Math.max(dim.x, dim.y, dim.z);
    m.scale.setScalar(s); m.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s - H / 2, -((box.min.z + box.max.z) / 2) * s);
    const g = new THREE.Group(); g.add(m);
    return g;
  }, [scene]);
  const swing = useRef<THREE.Group>(null), big = kind === "trail" || kind === "water" ? 2.2 : 1, clock = useRef({ t: 0, frozen: 0 });
  // Held and moved as a hand moves it: a slow sway and turn (a swing for the trail and the water), so what trails or falls
  // is left behind; held still through a strike's freeze frame.
  useFrame((_, delta) => {
    const c = clock.current, g = swing.current;
    if (c.frozen > 0) c.frozen -= delta; else c.t += delta;
    if (g) g.rotation.set(0.12 * Math.sin(c.t * 0.7), 0.5 * Math.sin(c.t * 0.45), 0.32 * big * Math.sin(c.t * 1.25 * big ** 0.5));
  });
  const kinds = STRIKES.includes(kind) ? [] : ([kind] as FxKind[]);
  const onHit = useMemo(() => (ms: number) => { clock.current.frozen = ms / 1000; }, []);
  return <group position={[x, 0, 0]}><group ref={swing} position={[0, -H / 2, 0]}><group position={[0, H / 2, 0]}>
    <primitive object={holder} />
    <HolderFx holder={holder} kinds={kinds} strength={k} once={once} strike={STRIKES.includes(kind) ? { kind: kind as StrikeKind, hit: 1.4, key: strike, onHit } : undefined} />
  </group></group></group>;
}

/**
 * The Sway type's sample: the Cedar rod (its foliage is its effect, RodAura springs it), swung hard and stopped dead in
 * turn, so its leaves swing after it and settle.
 */
function Cedar({ k }: { k: number }) {
  const { scene } = useGLTF("/assets/game/tools/rod-2.glb");
  const rod = useMemo(() => scene.clone(true), [scene]), fx = rodFxUrl(rod), swing = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 3, g = swing.current;
    // a quick swing out and back over a second, then held still for two
    if (g) g.rotation.z = t < 1 ? 0.55 * Math.sin(Math.PI * 2 * t) * (1 - t) : 0;
  });
  return <group ref={swing} position={[0, -1.05, 0]} scale={1.9}><primitive object={rod} />{fx && <RodAura rod={rod} url={fx} strength={k} />}</group>;
}

/** One type alone, large, on both holders, its strength rising from 1 to 2.5 and back every few seconds. */
function Solo({ kind, k }: { kind: Solo; k: number }) {
  const [once, setOnce] = useState(0), [strike, setStrike] = useState(0), [tint, setTint] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setOnce(n => n + 1), kind === "burst" ? 2200 : 1500);
    const s = window.setInterval(() => setStrike(n => n + 1), 3600);
    return () => { window.clearInterval(t); window.clearInterval(s); };
  }, [kind]);
  useEffect(() => {
    if (kind !== "burst" || !once) return;
    const on = window.setTimeout(() => setTint(true)), off = window.setTimeout(() => setTint(false), FX.burst.params.ms.value);
    return () => { window.clearTimeout(on); window.clearTimeout(off); };
  }, [kind, once]);
  const info = STRIKES.includes(kind) ? { name: "Strike: lightning", what: STRIKE_WHAT[kind as StrikeKind] } : FX[kind as FxKind];
  return <main style={{ position: "fixed", inset: 0, background: "#1b1f2a", color: "#eef2f8" }} data-testid="fx-solo" data-fx={kind} data-k={k}>
    {kind === "burst" && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#7FD8FF", opacity: tint ? fxAt("burst", "tint") : 0, transition: `opacity ${tint ? 0.12 : 0.6}s ease-out` }} />}
    <Canvas camera={{ position: [0, 0, 3.4], fov: 45 }} dpr={1} gl={{ antialias: true }}>
      {/* opaque, as the game's canvas is (an additive effect writes alpha: on a clear canvas the page would show through it) */}
      <color attach="background" args={["#1b1f2a"]} />
      <ambientLight intensity={1.1} /><directionalLight position={[-1, 2, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        {kind === "sway" ? <Cedar k={k} />
          : HOLDERS.map((url, i) => <Holder key={url} url={url} x={i ? 0.8 : -0.8} kind={kind} k={k} once={once} strike={strike} />)}
      </Suspense>
    </Canvas>
    <div style={{ position: "absolute", left: 20, top: 44, right: 20, pointerEvents: "none", font: "600 17px/1.3 system-ui" }}>
      {info.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>strength {k}</span>
      <div style={{ font: "14px/1.4 system-ui", opacity: 0.72, marginTop: 4, maxWidth: 640 }}>{info.what}</div>
    </div>
  </main>;
}

const STRIKES: string[] = ["lightning"];
const STRIKE_WHAT: Record<StrikeKind, string> = {
  lightning: "An outside thing acting on it: the charge builds at the tip, crackling faster and reaching down it, a held breath, then a bolt out of the sky; it flashes white, freezes a moment and shakes, and arcs crawl over it after.",
};
type Solo = FxKind | StrikeKind;
const ORDER: Solo[] = ["energy", "glow", "pulse", "particles", "trail", "motion", "sparks", "burst", "water", "electricity", "embers", "flame", "petals", "gather", "sway", "lightning"];

export default function FxLab() {
  const [k, setK] = useState(1), [study, setStudy] = useState<string | null>(null), [solo, setSolo] = useState<Solo | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), fixed = Number(q.get("k"));
    const read = window.setTimeout(() => { setStudy(q.get("study")); setSolo(ORDER.find(x => x === q.get("type")) ?? null); });
    const t = window.setInterval(() => setK(x => fixed || (x === 1 ? 2.5 : 1)), fixed ? 50 : 4000);
    return () => { window.clearTimeout(read); window.clearInterval(t); };
  }, []);
  if (study === "tidewarden") return <main style={{ padding: 0 }}><Study k={k} of={study} /></main>;
  if (solo) return <Solo kind={solo} k={k} />;
  // The index: the two families, one type at a time (each its own canvas, so each its own clip).
  const family = (f: "aura" | "effect") => ORDER.filter(kind => STRIKES.includes(kind) ? f === "effect" : FX[kind as FxKind].family === f);
  return <main style={{ padding: "56px 24px", font: "15px/1.5 system-ui", display: "grid", gap: 6, justifyContent: "start" }} data-testid="fx-lab">
    <h1 style={{ font: "600 20px/1.3 system-ui" }}>VFX library</h1>
    {(["aura", "effect"] as const).map(f => <section key={f} style={{ display: "grid", gap: 4 }}>
      <h2 style={{ font: "600 15px/1.3 system-ui", marginTop: 12 }}>{f === "aura" ? "Auras (energy, on its own parts)" : "Effects (what happens to it)"}</h2>
      {family(f).map(kind => <a key={kind} href={`/lab/fx?type=${kind}`}>{STRIKES.includes(kind) ? `Strike: ${kind}` : FX[kind as FxKind].name}</a>)}
    </section>)}
  </main>;
}
