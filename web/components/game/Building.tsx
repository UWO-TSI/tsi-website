"use client";

import { Suspense, useMemo, useRef } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useActivePalette } from "@/lib/content/loader";
import { GLBProp } from "./NatureModels";

// Matches GameWorld's central sweep INTERACT_RADIUS so the "Press E"
// prompt never shows outside the range where E actually fires.
const INTERACT_RANGE = 3.5;
// Art pass 2026-07-07 pt2: name pills only appear when the player is
// close — nine always-on floating tags read as UI clutter over the map.
// Playtest 2026-07-13: 9u read as "always hovering"; labels now appear
// only genuinely near, and anchor just above the roofline instead of
// floating 1.8u over it.
const LABEL_RANGE = 6;

// ─── Procedural variants — fallback only (G1 visual overhaul) ───
//
// As of 2026-06-01: GLB models exist for hq/shop/oracle/house and load via
// the Suspense + <GLBBuilding> path below. The procedural composites that
// A4 originally shipped now live as the Suspense fallback (loads while the
// GLB is fetching) and as the ultimate fallback if a GLB ever fails.
//
// To force procedural rendering for a specific id (e.g. for debugging or
// if a GLB looks worse than the placeholder), add it to this set.
const PROC_VARIANTS = new Set<string>();

/** Gable / wedge roof: two sloped slab boxes meeting at a center ridge, plus triangular gable end-caps. */
function GableRoof({ width, depth, height, color }: { width: number; depth: number; height: number; color: string }) {
  const slopeLen = Math.sqrt((width / 2) * (width / 2) + height * height);
  const angle = Math.atan2(height, width / 2);
  const slabThickness = 0.15;
  const gableShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(0, height);
    s.lineTo(-width / 2, 0);
    return s;
  }, [width, height]);

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (width / 4), height / 2, 0]}
          rotation={[0, 0, side * angle]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[slopeLen, slabThickness, depth]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`cap-${side}`} position={[0, 0, side * (depth / 2)]} castShadow receiveShadow>
          <shapeGeometry args={[gableShape]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** HQ — Town Hall: wide base, peaked roof, banner pole + flag. */
function HQBuilding() {
  const W = 7, H = 4, D = 5;
  const roofH = 2;
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#D4A574" roughness={0.9} metalness={0} />
      </mesh>
      <group position={[0, H, 0]}>
        <GableRoof width={W} depth={D} height={roofH} color="#8B5A3C" />
      </group>
      {/* Banner pole on roof peak */}
      <mesh position={[0, H + roofH + 1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 2, 8]} />
        <meshStandardMaterial color="#5C4030" roughness={0.85} metalness={0} />
      </mesh>
      {/* Flag */}
      <mesh position={[0.7, H + roofH + 1.4, 0]} castShadow>
        <planeGeometry args={[1.2, 0.8]} />
        <meshStandardMaterial color="#E87B5A" roughness={0.85} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1, D / 2 + 0.01]}>
        <planeGeometry args={[1.2, 2]} />
        <meshStandardMaterial color="#5C3A26" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/** Shop — small cottage with awning + sign. */
function ShopBuilding() {
  const W = 4, H = 3, D = 4;
  const roofH = 1.4;
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#C9A87C" roughness={0.9} metalness={0} />
      </mesh>
      <group position={[0, H, 0]}>
        <GableRoof width={W} depth={D} height={roofH} color="#A0522D" />
      </group>
      {/* Awning over front door */}
      <mesh position={[0, 2.1, D / 2 + 0.4]} castShadow>
        <boxGeometry args={[3, 0.3, 0.8]} />
        <meshStandardMaterial color="#8B5A3C" roughness={0.85} metalness={0} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.9, D / 2 + 0.01]}>
        <planeGeometry args={[1, 1.6]} />
        <meshStandardMaterial color="#5C3A26" roughness={0.9} metalness={0} />
      </mesh>
      {/* Shop sign */}
      <mesh position={[W / 2 - 0.6, 1.6, D / 2 + 0.05]} castShadow>
        <planeGeometry args={[0.5, 0.9]} />
        <meshStandardMaterial color="#E87B5A" roughness={0.8} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Oracle Temple — tall narrow stone tower, dome, spire, flanking braziers. */
function OracleTemple() {
  const W = 5, H = 6, D = 5;
  const flameTime = useRef(0);
  const flameLeft = useRef<THREE.Group>(null);
  const flameRight = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    flameTime.current += delta;
    const s = 1 + Math.sin(flameTime.current * 8) * 0.08;
    if (flameLeft.current) flameLeft.current.scale.y = s;
    if (flameRight.current) flameRight.current.scale.y = s;
  });

  return (
    <group>
      {/* Tall base (taller than wide — per A1 elevation note) */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#B0A89A" roughness={0.92} metalness={0} />
      </mesh>
      {/* Dome drum */}
      <mesh position={[0, H + 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.5, 2.5, 0.5, 16]} />
        <meshStandardMaterial color="#B0A89A" roughness={0.92} metalness={0} />
      </mesh>
      {/* Dome cap */}
      <mesh position={[0, H + 0.5, 0]} castShadow receiveShadow>
        <sphereGeometry args={[2.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8B6F4E" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Spire */}
      <mesh position={[0, H + 0.5 + 2.5 + 1.5, 0]} castShadow>
        <coneGeometry args={[1.5, 3, 12]} />
        <meshStandardMaterial color="#8B6F4E" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.3, D / 2 + 0.01]}>
        <planeGeometry args={[1.4, 2.6]} />
        <meshStandardMaterial color="#3D2817" roughness={0.95} metalness={0} />
      </mesh>
      {/* Flanking braziers */}
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 2.0, 0, D / 2 + 0.6]}>
          {/* Brazier base */}
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.6, 10]} />
            <meshStandardMaterial color="#3D2817" roughness={0.92} metalness={0} />
          </mesh>
          {/* Flame (scale-animated) */}
          <group ref={i === 0 ? flameLeft : flameRight} position={[0, 0.9, 0]}>
            <mesh castShadow>
              <coneGeometry args={[0.25, 0.6, 10]} />
              <meshStandardMaterial
                color="#FFA040"
                emissive="#FF6020"
                emissiveIntensity={1.5}
                roughness={0.5}
                metalness={0}
              />
            </mesh>
          </group>
          {/* Warm point light for ambience */}
          <pointLight position={[0, 1.1, 0]} color="#FF8040" intensity={0.6} distance={4} decay={2} />
        </group>
      ))}
    </group>
  );
}

function ProceduralBuilding({ id }: { id: string }) {
  switch (id) {
    case "hq":
      return <HQBuilding />;
    case "shop":
      return <ShopBuilding />;
    case "oracle":
    case "temple":
      return <OracleTemple />;
    default:
      return null;
  }
}

// ─── GLB model paths for buildings with real 3D assets ──────────
const GLB_PATHS: Record<string, string> = {
  hq: "/assets/buildings/hq.glb",
  shop: "/assets/buildings/shop.glb",
  oracle: "/assets/buildings/oracle_temple.glb",
  house: "/assets/buildings/house_1.glb",
};

// ─── ACNH textured building models (2026-07 revamp) ─────────────
// Source pack is authored at ~10 units per meter; ACNH_SCALE brings them
// into world units. Models keep their own textures/materials (unlike
// GLBBuilding, which flat-color-overrides). Grounding: ACNH buildings put
// their walk-in floor at y=0 in model space and extend foundation BELOW
// (for slope placement), so we scale about the origin and do NOT re-ground
// by bbox min — that would hoist the foundation into view.
const ACNH_SCALE = 0.1;

// M1 (2026-07-26): buildings are composed from PARTS, not one merged file.
//
// ACNH authors a building as separate wall / roof / door assets in a SHARED
// coordinate space — the roof already sits at its correct height in its own
// file, so the parts need no transform, only mounting in one group. The
// previous single-file exports were merged by the lost ad-hoc pipeline, which
// dropped meshes doing it: the chalet shipped with 7 of its 15 meshes, missing
// mWindowGlass, mSideWindow, mCurtain and mLamp. The houses had no windows.
//
// Composing at load time instead of merging offline keeps the extractor honest
// (one .dae in, one .glb out, mesh-count gated) and costs a few extra draw
// calls, which the grid renderer's batching pass addresses globally.
const B = "/assets/acnh/buildings";

/** Chalet variants are a wall + roof pairing over the shared standard door. */
function chaletParts(wall: string, roof: string): string[] {
  return [`${B}/chalet-wall-${wall}.glb`, `${B}/chalet-roof-${roof}.glb`, `${B}/chalet-door.glb`];
}

/** Ambient chalet colourways (scenery only — see GameWorld's south green). */
export const CHALET_VARIANTS = {
  brown: chaletParts("a", "b"),
  red: chaletParts("c", "g"),
  yellow: chaletParts("e", "e"),
} as const;

const ACNH_GLB: Record<string, { parts: string[]; scale?: number; yOffset?: number; rotationY?: number }> = {
  hq: { parts: [`${B}/hq-office.glb`, `${B}/hq-office-door.glb`], rotationY: Math.PI },
  shop: { parts: [`${B}/shop-market.glb`, `${B}/shop-market-door.glb`], rotationY: Math.PI },
  oracle: { parts: [`${B}/oracle-museum.glb`], rotationY: Math.PI },
  house: { parts: CHALET_VARIANTS.brown, rotationY: Math.PI },
};

/** Shared material pass: ACNH albedo carries the look, so kill PBR shine. */
function matteACNH(root: THREE.Object3D, castShadow: boolean) {
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.metalness = 0;
        std.roughness = Math.max(std.roughness, 0.85);
      }
    }
  });
}

/**
 * Mounts a part list as one group. Parts share the source coordinate space.
 *
 * Plain `.clone(true)` is safe here ONLY because the extractor strips skinning
 * (see stripSkinning in scripts/extract-acnh-kit.mjs). Skinned clones do not
 * rebind their skeleton and explode into shards.
 */
export function ACNHParts({
  parts,
  scale = 1,
  yOffset = 0,
  rotationY = 0,
  castShadow = true,
}: {
  parts: readonly string[];
  scale?: number;
  yOffset?: number;
  rotationY?: number;
  castShadow?: boolean;
}) {
  const gltfs = useGLTF(parts as string[]);
  const group = useMemo(() => {
    const g = new THREE.Group();
    for (const { scene } of gltfs) g.add(scene.clone(true));
    g.scale.setScalar(scale * ACNH_SCALE);
    g.position.y = yOffset;
    g.rotation.y = rotationY;
    matteACNH(g, castShadow);
    return g;
  }, [gltfs, scale, yOffset, rotationY, castShadow]);

  return <primitive object={group} />;
}

/** ACNH building: fixed scale, origin-grounded, original materials kept. */
function ACNHBuilding({ id }: { id: string }) {
  const cfg = ACNH_GLB[id];
  return (
    <ACNHParts
      parts={cfg.parts}
      scale={cfg.scale ?? 1}
      yOffset={cfg.yOffset ?? 0}
      rotationY={cfg.rotationY ?? 0}
    />
  );
}

for (const cfg of Object.values(ACNH_GLB)) for (const url of cfg.parts) useGLTF.preload(url);
for (const parts of Object.values(CHALET_VARIANTS)) for (const url of parts) useGLTF.preload(url);

// ─── Seasonal shop deco (principle #8: monthly content, no code pushes) ─
// The ACNH pack ships Nook's Cranny seasonal overlays that align at
// identity with the market model. When the admin-activated seasonal
// palette's slug/name mentions a season, the shop dresses itself to match.
// Specific holidays win over generic seasons; no match → no deco.
const SHOP_DECO_SEASONS = ["christmas", "halloween", "winter", "autumn", "summer", "spring"] as const;
function shopDecoUrl(paletteText: string): string | null {
  const t = paletteText.toLowerCase();
  if (t.includes("fall")) return "/assets/acnh/buildings/shop-deco-autumn.glb";
  for (const s of SHOP_DECO_SEASONS) {
    if (t.includes(s)) return `/assets/acnh/buildings/shop-deco-${s}.glb`;
  }
  return null;
}

/** Deco overlay: same model space as the shop, so same transform. */
function ACNHDeco({ id, url }: { id: string; url: string }) {
  const cfg = ACNH_GLB[id];
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar((cfg.scale ?? 1) * ACNH_SCALE);
    clone.position.y = cfg.yOffset ?? 0;
    if (cfg.rotationY) clone.rotation.y = cfg.rotationY;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = true;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });
    return clone;
  }, [scene, cfg]);
  return <primitive object={cloned} />;
}

/**
 * Loads a real GLB model, auto-scales to fit expected dimensions,
 * and overrides materials with AC palette colors.
 */
function GLBBuilding({ id, size, color }: { id: string; size: [number, number, number]; color: string }) {
  const { scene } = useGLTF(GLB_PATHS[id]);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);

    // Auto-scale to fit the expected bounding box
    const box = new THREE.Box3().setFromObject(clone);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const maxModel = Math.max(modelSize.x, modelSize.y, modelSize.z);
    const maxTarget = Math.max(size[0], size[1], size[2]);
    if (maxModel > 0) clone.scale.setScalar(maxTarget / maxModel);

    // Re-center horizontally, ground at y=0
    box.setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const min = box.min;
    clone.position.set(-center.x, -min.y, -center.z);

    // Override materials with AC palette
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color, roughness: 0.85, metalness: 0,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return clone;
  }, [scene, color, size]);

  return <primitive object={cloned} />;
}

/**
 * AC-style building per specs/ux-game-world-v2.md Section 6.
 * Pastel walls, bold roof with overhang, oversized door, arched windows,
 * chimney, flower boxes, awning. MeshStandardMaterial throughout.
 */
function ACBuilding({ size, color, roofColor: roofColorProp }: { size: [number, number, number]; color: string; roofColor?: string }) {
  const [sx, sy, sz] = size;
  const roofH = sy * 0.45;
  const roofColor = roofColorProp ? new THREE.Color(roofColorProp) : new THREE.Color(color).multiplyScalar(0.55);

  return (
    <group>
      {/* Walls */}
      <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </mesh>
      {/* Roof with overhang */}
      <mesh position={[0, sy + roofH / 2 - 0.1, 0]} castShadow>
        <coneGeometry args={[Math.max(sx, sz) * 0.78, roofH, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.85} metalness={0} />
      </mesh>
      {/* Chimney — v2 spec: #C4A265 */}
      <mesh position={[sx * 0.25, sy + roofH * 0.4, -sz * 0.2]} castShadow>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
        <meshStandardMaterial color="#C4A265" roughness={0.9} metalness={0} />
      </mesh>
      {/* Door frame — #6B4226 */}
      <mesh position={[0, 0.7, sz / 2 + 0.01]}>
        <planeGeometry args={[1.2, 1.6]} />
        <meshStandardMaterial color="#6B4226" roughness={0.9} metalness={0} />
      </mesh>
      {/* Door — #8B5E3C, oversized */}
      <mesh position={[0, 0.7, sz / 2 + 0.02]}>
        <planeGeometry args={[1.0, 1.4]} />
        <meshStandardMaterial color="#8B5E3C" roughness={0.85} metalness={0} />
      </mesh>
      {/* Windows — #B8E4F0 glass, #FFFFFF frame */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (sx * 0.3), sy * 0.55, sz / 2 + 0.01]}>
            <planeGeometry args={[0.65, 0.65]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.9} metalness={0} />
          </mesh>
          <mesh position={[side * (sx * 0.3), sy * 0.55, sz / 2 + 0.02]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshStandardMaterial color="#B8E4F0" roughness={0.4} metalness={0} emissive="#FFE4B0" emissiveIntensity={0.12} />
          </mesh>
        </group>
      ))}
      {/* Awning over door */}
      <mesh position={[0, 1.55, sz / 2 + 0.3]} rotation={[0.3, 0, 0]} castShadow>
        <planeGeometry args={[1.6, 0.5]} />
        <meshStandardMaterial color={roofColor} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Flower boxes under windows */}
      {[-1, 1].map((side) => (
        <group key={`fb-${side}`} position={[side * (sx * 0.3), sy * 0.25, sz / 2 + 0.15]}>
          <mesh castShadow><boxGeometry args={[0.5, 0.12, 0.15]} /><meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} /></mesh>
          {[-0.15, 0, 0.15].map((dx, i) => (
            <mesh key={i} position={[dx, 0.12, 0]}><sphereGeometry args={[0.06, 6, 6]} /><meshStandardMaterial color={i === 1 ? "#FFD166" : "#FF8CB0"} roughness={0.8} metalness={0} /></mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Board/sign — the real ACNH bulletin board (bbs.glb, 1.7×1.8×0.3 at world
 * scale — a near-exact match for the old procedural sign's footprint).
 * Procedural composite kept as the Suspense fallback.
 */
function BoardSignProcedural({ size, color }: { size: [number, number, number]; color: string }) {
  const [sx, sy] = size;
  return (
    <group>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x * sx * 0.6, sy / 2, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, sy, 8]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} />
        </mesh>
      ))}
      <mesh position={[0, sy * 0.65, 0]} castShadow>
        <boxGeometry args={[sx, sy * 0.5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, sy * 0.95, 0]} castShadow>
        <boxGeometry args={[sx * 1.2, 0.08, 0.35]} />
        <meshStandardMaterial color="#8B6B4A" roughness={0.9} metalness={0} />
      </mesh>
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, sy * 0.65 + (i - 1) * 0.08, 0.09]} rotation={[0, 0, (i - 1) * 0.15]}>
          <planeGeometry args={[0.25, 0.3]} />
          <meshStandardMaterial color={["#FFD166", "#FF8CB0", "#6BA3D6"][i]} roughness={0.8} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

function BoardSign({ size, color }: { size: [number, number, number]; color: string }) {
  return (
    <Suspense fallback={<BoardSignProcedural size={size} color={color} />}>
      <GLBProp url="/assets/acnh/props/bulletin-board.glb" rotation={[0, Math.PI, 0]} />
    </Suspense>
  );
}

/**
 * Leaderboard monument — v2 spec Section 6.6.
 */
function LeaderboardMonument({ size, color }: { size: [number, number, number]; color: string }) {
  const [sx, sy] = size;
  return (
    <group>
      {/* Stone base */}
      <mesh position={[0, sy * 0.3, 0]} castShadow>
        <cylinderGeometry args={[sx * 0.5, sx * 0.6, sy * 0.6, 8]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      {/* Column */}
      <mesh position={[0, sy * 0.6, 0]} castShadow>
        <cylinderGeometry args={[sx * 0.3, sx * 0.35, sy * 0.5, 8]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
      </mesh>
      {/* Gold trophy */}
      <mesh position={[0, sy * 0.9, 0]} castShadow>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#FFD166" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Plaques */}
      {[-0.2, 0, 0.2].map((y, i) => (
        <mesh key={i} position={[sx * 0.5 + 0.01, sy * 0.25 + y, 0]}>
          <planeGeometry args={[0.3, 0.12]} />
          <meshStandardMaterial color={["#FFD166", "#C0C0C0", "#CD7F32"][i]} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

interface BuildingProps {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roofColor?: string;
  href?: string;
  playerPosition: THREE.Vector3;
}

export default function Building({ id, name, position, size, color, roofColor, href, playerPosition }: BuildingProps) {
  const dist = useMemo(() => {
    return new THREE.Vector3(...position).distanceTo(playerPosition);
  }, [position, playerPosition]);
  const isNear = dist < INTERACT_RANGE;
  const labelNear = dist < LABEL_RANGE;

  const { data: activePalette } = useActivePalette();
  const decoUrl = id === "shop"
    ? shopDecoUrl(`${activePalette?.slug ?? ""} ${activePalette?.display_name ?? ""}`)
    : null;

  // E-navigation lives in GameWorld's central interact sweep (ACNH revamp):
  // this component's own keydown listener double-fired against the sweep
  // when a board's range overlapped another interactable. Building renders
  // the model + prompt only; `href` still gates the prompt copy below.

  const isBoard = size[2] < 1;
  const isLeaderboard = id === "leaderboard";
  const isProcedural = PROC_VARIANTS.has(id);
  const hasACNH = id in ACNH_GLB;
  const hasGLB = id in GLB_PATHS;

  return (
    <group position={position}>
      {isBoard ? (
        <BoardSign size={size} color={color} />
      ) : isLeaderboard ? (
        <LeaderboardMonument size={size} color={color} />
      ) : isProcedural ? (
        <ProceduralBuilding id={id} />
      ) : hasACNH ? (
        <>
          <Suspense fallback={<ACBuilding size={size} color={color} roofColor={roofColor} />}>
            <ACNHBuilding id={id} />
          </Suspense>
          {decoUrl && (
            <Suspense fallback={null}>
              <ACNHDeco id={id} url={decoUrl} />
            </Suspense>
          )}
        </>
      ) : hasGLB ? (
        <Suspense fallback={<ACBuilding size={size} color={color} roofColor={roofColor} />}>
          <GLBBuilding id={id} size={size} color={color} />
        </Suspense>
      ) : (
        <ACBuilding size={size} color={color} roofColor={roofColor} />
      )}

      {/* Label — white pill, dark text. Proximity-gated with a soft
          fade-in so approaching a building "reveals" its name. */}
      {labelNear && (
        <Html zIndexRange={[40, 0]} position={[0, size[1] + 0.7, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div style={{ fontSize: "13px", color: "#2a2a2a", background: "rgba(255,255,255,0.88)", padding: "3px 10px", borderRadius: "6px", fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", boxShadow: "0 1px 4px rgba(0,0,0,0.12)", whiteSpace: "nowrap", animation: "tsi-label-in 0.25s ease-out" }}>
            {name}
            <style>{`@keyframes tsi-label-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>
          </div>
        </Html>
      )}

      {isNear && href && (
        <Html zIndexRange={[40, 0]} position={[0, size[1] + 0.8, 0]} center style={{ pointerEvents: "none" }}>
          <div className="animate-bounce" style={{ fontSize: "14px", color: "#fff", background: "#4a6fa5", padding: "5px 14px", borderRadius: "10px", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
            Press <kbd style={{ color: "#FFD166", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>E</kbd> to {isBoard ? "view" : "enter"}
          </div>
        </Html>
      )}
    </group>
  );
}
