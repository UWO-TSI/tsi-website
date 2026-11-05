"use client";

/**
 * /lab/fx: the effects library's previews (lib/game/fx/library.ts, specs/fx-library.md). Each type on a stand-in rod,
 * drawn by the game's own code (RodAura for the GLB types, glowOn and sparkRecipe for the code ones, the kit's burst),
 * its strength rising from 1 to 2.5 and back every few seconds so what grows shows. ?k=<n> holds one strength.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import TurnStage from "@/components/economy/TurnStage";
import RodAura from "@/components/game/character/RodAura";
import { useGlowParticles } from "@/components/game/GlowFx";
import { glowOn, sparkRecipe } from "@/lib/game/fx/glowOn";
import { FX, fxAt, type FxKind } from "@/lib/game/fx/library";
import css from "./fx.module.css";

/** The GLB types' samples (art/pipeline/fx_library.py samples). */
const SAMPLE: Partial<Record<FxKind, string>> = { glow: "glow", aura: "aura", particles: "particles", trail: "trail", pulse: "pulse", motion: "motion", flicker: "flicker" };
const ORDER: FxKind[] = ["glow", "aura", "particles", "trail", "pulse", "motion", "flicker", "sparks", "burst"];
/** The stand-in rod: a grey blank from the hand (rig units, as the samples are made), its grip darker. */
function useStick() {
  return useMemo(() => {
    const rod = new THREE.Group(), grey = new THREE.MeshStandardMaterial({ color: "#9aa3ad", roughness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: "#3b4048", roughness: 0.8 });
    const blank = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.7, 8), grey);
    blank.position.y = 0.41;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.18, 8), dark);
    grip.position.y = -0.03;
    rod.add(blank, grip);
    return rod;
  }, []);
}

function Sample({ kind, k }: { kind: FxKind; k: number }) {
  const rod = useStick(), glow = useGlowParticles(), live = useRef({ t: 0, lit: new Map<THREE.MeshStandardMaterial, THREE.Color>(), colour: new THREE.Color("#7FD8FF") });
  useFrame((_, dt) => {
    const x = live.current;
    x.t += Math.min(dt, 0.1);
    if (kind === "burst") {
      // The burst's flare on the thing: the glow up to its peak and down again, every three seconds.
      const u = (x.t % 3) / (FX.burst.params.ms.value / 1000);
      glowOn(rod, x.colour, u < 1 ? fxAt("burst", "peak") * Math.sin(Math.PI * u) : 0, x.lit);
    }
    if (kind === "sparks" && x.t > 1.4) {
      x.t = 0;
      const p = rod.localToWorld(new THREE.Vector3(0, 0.45, 0));
      glow.pool.burst(sparkRecipe(k), p.x, p.y, p.z, p.y - 5, 0, 0, 1, x.colour.getHex(), Math.floor(Math.random() * 1e6));
    }
  });
  // Close on the blank, where the effects are, below the card's text.
  return <group scale={3} position={[0, -1.65, 0]}>
    <primitive object={rod} />
    {SAMPLE[kind] && <RodAura rod={rod} url={`/assets/game/props/fxlib-${SAMPLE[kind]}.glb`} strength={k} />}
  </group>;
}

export default function FxLab() {
  const [k, setK] = useState(1), [burst, setBurst] = useState(false);
  useEffect(() => {
    const fixed = Number(new URLSearchParams(window.location.search).get("k"));
    const t = window.setInterval(() => setK(x => fixed || (x === 1 ? 2.5 : 1)), fixed ? 50 : 4000);
    return () => window.clearInterval(t);
  }, []);
  // The burst card's screen tint, in step with its flare.
  useEffect(() => {
    let off = 0;
    const t = window.setInterval(() => { setBurst(true); off = window.setTimeout(() => setBurst(false), FX.burst.params.ms.value); }, 3000);
    return () => { window.clearInterval(t); window.clearTimeout(off); };
  }, []);
  return <main style={{ padding: "56px 16px 16px", display: "grid", gridTemplateColumns: "repeat(3, 380px)", gap: 12, justifyContent: "center" }} data-testid="fx-lab" data-k={k}>
    {ORDER.map(kind => <section key={kind} data-fx={kind} style={{ position: "relative", height: 380, borderRadius: 16, overflow: "hidden", background: "#1b1f2a" } as CSSProperties}>
      {kind === "burst" && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#7FD8FF", opacity: burst ? fxAt("burst", "tint") : 0, transition: `opacity ${burst ? 0.12 : 0.6}s ease-out` }} />}
      <TurnStage className={css.stage} label={FX[kind].name} cameraZ={4.2}><Suspense fallback={null}><Sample kind={kind} k={k} /></Suspense></TurnStage>
      <div style={{ position: "absolute", left: 14, top: 10, right: 14, pointerEvents: "none", font: "600 14px/1.3 system-ui" }}>
        {FX[kind].name} <span style={{ opacity: 0.6, fontWeight: 400 }}>strength {k}</span>
        <div style={{ font: "12px/1.35 system-ui", opacity: 0.7, marginTop: 2 }}>{FX[kind].what}</div>
      </div>
    </section>)}
  </main>;
}
