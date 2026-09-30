"use client";

import { GLBProp } from "./NatureModels";

// ─── Lantern (ACNH round streetlamp) ────────────────────────────────────
// Model is ~2.7u tall with the globe at the top; the warm point light sits
// in the globe so night pools read like the W7 cozy lamps.
export function Lantern({ position, lampsOn = true, intensity, glow }: { position: [number, number, number]; lampsOn?: boolean; intensity?: number; glow?: number }) {
  return (
    <group position={position}>
      <GLBProp url="/assets/acnh/props/streetlamp.glb" emissiveIntensity={glow ?? (lampsOn ? 2.2 : 0)} />
      <pointLight color="#FFA040" intensity={intensity ?? (lampsOn ? 0.4 : 0)} distance={5} position={[0, 2.4, 0]} />
    </group>
  );
}
