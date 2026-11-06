"use client";

/**
 * /lab/fx: the effects library's previews (lib/game/fx/library.ts, specs/fx-library.md), one type at a time
 * (?type=<kind>; David 2026-11-06: "show me one by one the animation"): large, on a plain rod and a sword moving as a hand
 * moves them (the types are holder-agnostic), drawn by the game's own code (HolderFx), its strength rising from 1 to
 * 2.5 and back every few seconds so what grows shows. ?k=<n> holds one strength. The two strikes (?type=lightning,
 * ?type=wave) play every few seconds.
 * The Water type's sample is the 1:1 study of its reference, the Aquatic sword (art/pipeline/fx_library.py aquatic);
 * ?study=water draws it alone, flat to you, framed and sized as the reference is (736 by 1307), on its grey.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import RodAura, { rodFxUrl } from "@/components/game/character/RodAura";
import HolderFx from "@/components/game/fx/HolderFx";
import { FX, fxAt, type FxKind } from "@/lib/game/fx/library";
import type { StrikeKind } from "@/lib/game/fx/holder";

/** The Water type's sample, the Aquatic sword: 1 unit tall from its foot, so it holds itself (no stand-in rod). */
function Sword({ k }: { k: number }) {
  const holder = useMemo(() => new THREE.Group(), []);
  return <><primitive object={holder} /><RodAura rod={holder} url="/assets/game/props/fxlib-water.glb" strength={k} /></>;
}

/** Each study's reference: its size, its paper, px per unit, where the thing's origin is (px) and its lean (degrees). */
const STUDY = {
  water: { w: 736, h: 1307, bg: "#BBB4AC", ppu: 1225, at: [375, 1265], lean: 0, face: 0 },
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
      <group rotation={[0, 0, (f.lean * Math.PI) / 180]}><group rotation={[0, f.face, 0]}><Suspense fallback={null}>{of === "water" ? <Sword k={k} /> : <Trident k={k} />}</Suspense></group></group>
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
  const swing = useRef<THREE.Group>(null), big = kind === "trail" ? 2.2 : 1;
  // Held and moved as a hand moves it: a slow sway and turn (a swing for the trail), so what trails or falls is left behind.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, g = swing.current;
    if (g) g.rotation.set(0.12 * Math.sin(t * 0.7), 0.5 * Math.sin(t * 0.45), 0.32 * big * Math.sin(t * 1.25 * big ** 0.5));
  });
  const kinds = STRIKES.includes(kind) ? [] : ([kind] as FxKind[]);
  return <group position={[x, 0, 0]}><group ref={swing} position={[0, -H / 2, 0]}><group position={[0, H / 2, 0]}>
    <primitive object={holder} />
    <HolderFx holder={holder} kinds={kinds} strength={k} once={once} strike={STRIKES.includes(kind) ? { kind: kind as StrikeKind, hit: 0.7, key: strike } : undefined} />
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
  return <group ref={swing} position={[0, -1.1, 0]} scale={2.4}><primitive object={rod} />{fx && <RodAura rod={rod} url={fx} strength={k} />}</group>;
}

/** One type alone, large, on both holders, its strength rising from 1 to 2.5 and back every few seconds. */
function Solo({ kind, k }: { kind: Solo; k: number }) {
  const [once, setOnce] = useState(0), [strike, setStrike] = useState(0), [tint, setTint] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setOnce(n => n + 1), kind === "burst" ? 2200 : 1500);
    const s = window.setInterval(() => setStrike(n => n + 1), 3200);
    return () => { window.clearInterval(t); window.clearInterval(s); };
  }, [kind]);
  useEffect(() => {
    if (kind !== "burst" || !once) return;
    const on = window.setTimeout(() => setTint(true)), off = window.setTimeout(() => setTint(false), FX.burst.params.ms.value);
    return () => { window.clearTimeout(on); window.clearTimeout(off); };
  }, [kind, once]);
  const info = STRIKES.includes(kind) ? { name: kind === "lightning" ? "Strike: lightning" : "Strike: a wave", what: STRIKE_WHAT[kind as StrikeKind] } : FX[kind as FxKind];
  return <main style={{ position: "fixed", inset: 0, background: "#1b1f2a", color: "#eef2f8" }} data-testid="fx-solo" data-fx={kind} data-k={k}>
    {kind === "burst" && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#7FD8FF", opacity: tint ? fxAt("burst", "tint") : 0, transition: `opacity ${tint ? 0.12 : 0.6}s ease-out` }} />}
    <Canvas camera={{ position: [0, 0, 3.4], fov: 45 }} dpr={1} gl={{ antialias: true }}>
      <ambientLight intensity={1.1} /><directionalLight position={[-1, 2, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        {kind === "water" ? <group scale={2.3} position={[0, -1.25, 0]}><Sword k={k} /></group> : kind === "sway" ? <Cedar k={k} />
          : HOLDERS.map((url, i) => <Holder key={url} url={url} x={i ? 0.8 : -0.8} kind={kind} k={k} once={once} strike={strike} />)}
      </Suspense>
    </Canvas>
    <div style={{ position: "absolute", left: 20, top: 44, right: 20, pointerEvents: "none", font: "600 17px/1.3 system-ui" }}>
      {info.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>strength {k}</span>
      <div style={{ font: "14px/1.4 system-ui", opacity: 0.72, marginTop: 4, maxWidth: 640 }}>{info.what}</div>
    </div>
  </main>;
}

const STRIKES: string[] = ["lightning", "wave"];
const STRIKE_WHAT: Record<StrikeKind, string> = {
  lightning: "An outside thing acting on it: the tip crackles as the charge gathers, then a bolt comes down out of the sky onto it, forks and strikes twice more.",
  wave: "An outside thing acting on it: a crest rises beside it, curls and crashes over it, its spray flung up and falling.",
};
type Solo = FxKind | StrikeKind;
const ORDER: Solo[] = ["glow", "aura", "particles", "trail", "pulse", "motion", "flicker", "sparks", "burst", "water", "electricity", "embers", "flame", "petals", "gather", "sway", "lightning", "wave"];

export default function FxLab() {
  const [k, setK] = useState(1), [study, setStudy] = useState<string | null>(null), [solo, setSolo] = useState<Solo | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), fixed = Number(q.get("k"));
    const read = window.setTimeout(() => { setStudy(q.get("study")); setSolo(ORDER.find(x => x === q.get("type")) ?? null); });
    const t = window.setInterval(() => setK(x => fixed || (x === 1 ? 2.5 : 1)), fixed ? 50 : 4000);
    return () => { window.clearTimeout(read); window.clearInterval(t); };
  }, []);
  if (study === "water" || study === "tidewarden") return <main style={{ padding: 0 }}><Study k={k} of={study} /></main>;
  if (solo) return <Solo kind={solo} k={k} />;
  // The index: one type at a time (each its own canvas, so each its own clip).
  return <main style={{ padding: "56px 24px", font: "15px/1.5 system-ui", display: "grid", gap: 6, justifyContent: "start" }} data-testid="fx-lab">
    {ORDER.map(kind => <a key={kind} href={`/lab/fx?type=${kind}`}>{STRIKES.includes(kind) ? `Strike: ${kind}` : FX[kind as FxKind].name}</a>)}
  </main>;
}
