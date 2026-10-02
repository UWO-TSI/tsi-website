"use client";

/**
 * The subclass aura (design sheet §1.9; classes v2, replacing the family aura): up to 10 motes from the combat pack
 * (the kit's mote sprite) through its ramp, each drifting the kit's way (orbiting, rising or falling), size
 * 0.12–0.22 u, alpha at most 0.8, no lights. Tier 2 (mastery 10) adds a soft ring of light at the feet, tier 3 (20)
 * a second mote type. In combat it drops to 40% so it never competes with telegraphs. "Show my aura" hides it on
 * your own screen. Drawn in one instanced draw with the combat particles' shader and ramp table.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fireflyOffset } from "@/lib/game/fireflyPath";
import { COMBAT_PACK, COMBAT_PACK_COLS, COMBAT_PACK_URL, type CombatSprite } from "@/lib/game/fx/combatPack";
import { RampTable, sharedRamps } from "@/lib/game/fx/combat";
import { createCombatParticleMaterial, rampMap } from "@/lib/game/fx/fxMaterial";
import { masteryCosmetics } from "@/lib/combat/mastery";
import type { ClassKit } from "@/lib/combat/classes";
import { combat } from "@/lib/game/combat/runtime";
import { inCombat } from "@/lib/game/combat/classRuntime";

const MOTES = 8, SECOND = 2, N = MOTES + SECOND + 1;
let pack: THREE.Texture | null = null;
const frame = (sprite: CombatSprite, f: number) => COMBAT_PACK[sprite].row * COMBAT_PACK_COLS + f;

export default function SubclassAura({ player, kit, mastery, colour }: { player: React.RefObject<THREE.Vector3>; kit: ClassKit; mastery: number;
  /** The equipped aura colour (the mastery colour, a shop ramp's mid), else the kit's own ramp. */
  colour?: string | null }) {
  const tier = masteryCosmetics(mastery).aura;
  const d = useMemo(() => {
    const ramps = (sharedRamps.table ??= new RampTable());
    pack ??= new THREE.TextureLoader().load(COMBAT_PACK_URL);
    const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    for (const n of ["position", "uv"]) g.setAttribute(n, quad.getAttribute(n));
    const arr = [0, 1, 2, 3].map(() => new Float32Array(N * 4));
    arr.forEach((a, k) => g.setAttribute(`i${"ABCD"[k]}`, new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage)));
    g.instanceCount = N;
    const mesh = new THREE.Mesh(g, createCombatParticleMaterial(pack, rampMap(ramps), true));
    mesh.frustumCulled = false; mesh.renderOrder = 3.7; // over the terrain's painted sand and soil layers (2, 3), like the movement particles
    return { mesh, g, arr, ramps };
  }, []);
  useEffect(() => () => { d.g.dispose(); (d.mesh.material as THREE.Material).dispose(); }, [d]);
  const ramp = useMemo(() => d.ramps.row(colour ? [kit.look.ramp[0], colour, kit.look.ramp[2]] : kit.look.ramp), [d, kit, colour]);
  const mote = frame((kit.look.mote in COMBAT_PACK ? kit.look.mote : "mote") as CombatSprite, 2);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, p = player.current, dim = inCombat(combat.rt) ? 0.4 : 1, [A, B, C, D] = d.arr;
    rampMap(d.ramps);
    for (let i = 0; i < N; i++) {
      const q = i * 4, ring = i === N - 1, second = i >= MOTES && !ring, on = ring ? tier >= 2 : second ? tier >= 3 : true;
      let x = 0, y = 0.03, z = 0, size = 1.6, alpha = (0.3 + Math.sin(t * 1.5) * 0.05) * dim;
      if (!ring) {
        if (kit.look.drift === "orbit") { const o = fireflyOffset(i + 41, t * 1.4); x = o[0] * 0.75; y = 0.15 + o[1] * 1.1; z = o[2] * 0.75; }
        else { // rise or fall through 1.6 u round you, each on its own loop
          const u = (t * 0.35 + i * 0.37) % 1, a = i * 2.39996 + t * 0.4, r = 0.45 + (i % 3) * 0.12;
          x = Math.cos(a) * r; z = Math.sin(a) * r; y = kit.look.drift === "rise" ? 0.1 + u * 1.6 : 1.7 - u * 1.6;
        }
        // The mote's glow fills about a third of its cell: the quad is 3× the mote (0.12–0.22 u).
        size = (second ? 0.22 : 0.12 + (i % 3) * 0.05) * 3;
        alpha = Math.min(0.8, 0.55 + Math.sin(t * 2 + i * 1.7) * 0.25) * dim;
      }
      A[q] = p.x + x; A[q + 1] = p.y + y; A[q + 2] = p.z + z; A[q + 3] = p.y - 10; // never faded into the ground
      B[q] = B[q + 1] = size; B[q + 2] = ring ? t * 0.3 : 0; B[q + 3] = ring ? frame("halo", 3) : second ? frame("flare", 1) : mote;
      C[q] = C[q + 1] = C[q + 2] = 1; C[q + 3] = on ? alpha : 0;
      D[q] = 1; D[q + 1] = ramp; D[q + 2] = 0; D[q + 3] = ring ? 1 : 0; // flat on the ground, or facing you
    }
    for (const a of Object.values(d.g.attributes)) if ((a as THREE.InstancedBufferAttribute).isInstancedBufferAttribute) (a as THREE.InstancedBufferAttribute).needsUpdate = true;
  });
  return <primitive object={d.mesh} />;
}
