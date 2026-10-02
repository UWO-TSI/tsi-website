"use client";

/**
 * The subclass aura (design sheet §1.9; classes v2, replacing the family aura): up to 10 motes from the combat pack
 * (the kit's mote sprite) in its ramp's mid colour, each drifting the kit's way (orbiting, rising or falling), size
 * 0.12–0.22 u, alpha at most 0.8, no lights. Tier 2 (mastery 10) adds a soft ring of light at the feet, tier 3 (20)
 * a second mote type. In combat it drops to 40% so it never competes with telegraphs. "Show my aura" hides it on
 * your own screen.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { fireflyOffset } from "@/lib/game/fireflyPath";
import { COMBAT_PACK, COMBAT_PACK_COLS, COMBAT_PACK_ROWS, COMBAT_PACK_URL, type CombatSprite } from "@/lib/game/fx/combatPack";
import { masteryCosmetics } from "@/lib/combat/mastery";
import type { ClassKit } from "@/lib/combat/classes";
import { combat } from "@/lib/game/combat/runtime";
import { inCombat } from "@/lib/game/combat/classRuntime";

const MOTES = 8, SECOND = 2;
/** One frame of the combat pack as its own texture (shares the loaded image). */
function frameOf(atlas: THREE.Texture, sprite: CombatSprite, frame = 2) {
  const t = atlas.clone();
  t.colorSpace = THREE.NoColorSpace;
  t.repeat.set(1 / COMBAT_PACK_COLS, 1 / COMBAT_PACK_ROWS);
  t.offset.set(frame / COMBAT_PACK_COLS, 1 - (COMBAT_PACK[sprite].row + 1) / COMBAT_PACK_ROWS);
  t.needsUpdate = true;
  return t;
}

export default function SubclassAura({ player, kit, mastery, colour }: { player: React.RefObject<THREE.Vector3>; kit: ClassKit; mastery: number;
  /** The equipped aura colour (a shop ramp's mid, or the mastery colour), else the kit's. */
  colour?: string | null }) {
  const tier = masteryCosmetics(mastery).aura, atlas = useLoader(THREE.TextureLoader, COMBAT_PACK_URL); // suspends until the pack is in
  const look = useMemo(() => ({
    mote: frameOf(atlas, (kit.look.mote in COMBAT_PACK ? kit.look.mote : "mote") as CombatSprite), second: frameOf(atlas, "flare", 1), ring: frameOf(atlas, "halo", 3),
  }), [atlas, kit.look.mote]);
  useEffect(() => () => { look.mote.dispose(); look.second.dispose(); look.ring.dispose(); }, [look]);
  const color = colour ?? kit.look.ramp[1];
  const refs = useRef<(THREE.Sprite | null)[]>([]), ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, p = player.current, dim = inCombat(combat.rt) ? 0.4 : 1;
    for (let i = 0; i < refs.current.length; i++) {
      const m = refs.current[i];
      if (!m) continue;
      let x: number, y: number, z: number;
      if (kit.look.drift === "orbit") { const o = fireflyOffset(i + 41, t * 1.4); x = o[0] * 0.75; y = 0.15 + o[1] * 1.1; z = o[2] * 0.75; }
      else { // rise or fall through 1.6 u round you, each on its own loop
        const u = ((t * 0.35 + i * 0.37) % 1), a = i * 2.39996 + t * 0.4, r = 0.45 + (i % 3) * 0.12;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = kit.look.drift === "rise" ? 0.1 + u * 1.6 : 1.7 - u * 1.6;
      }
      m.position.set(p.x + x, p.y + y, p.z + z);
      (m.material as THREE.SpriteMaterial).opacity = (0.55 + Math.sin(t * 2 + i * 1.7) * 0.25) * dim;
    }
    if (ring.current) { ring.current.position.set(p.x, p.y + 0.03, p.z); (ring.current.material as THREE.MeshBasicMaterial).opacity = (0.32 + Math.sin(t * 1.5) * 0.06) * dim; }
  });
  const motes = [...Array.from({ length: MOTES }, (_, i) => ({ map: look.mote, size: 0.14 + (i % 3) * 0.04 })), ...(tier >= 3 ? Array.from({ length: SECOND }, () => ({ map: look.second, size: 0.22 })) : [])];
  return <group>
    {motes.map((m, i) => <sprite key={i} ref={el => { refs.current[i] = el; }} scale={[m.size, m.size, 1]}>
      <spriteMaterial map={m.map} color={color} transparent opacity={0.8} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </sprite>)}
    {tier >= 2 && <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1.5}>
      <planeGeometry args={[1.5, 1.5]} />
      <meshBasicMaterial map={look.ring} color={color} transparent opacity={0.32} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </mesh>}
  </group>;
}
