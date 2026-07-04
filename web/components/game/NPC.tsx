"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import type { NPCPersona } from "@/lib/game/contentTypes";

/**
 * NPC (sprint D5; sprites landed 2026-07-03 cozy push) — billboard for a
 * non-player character.
 *
 * With `persona.sprite_url` set, renders a pixel-art idle sheet (4 frames of
 * 16x16 across a 64x16 PNG — the Ninja Adventure CC0 layout) animated at
 * ~5fps with NearestFilter. Falls back to the original hue-hashed quad while
 * the texture loads, on load error, or when sprite_url is null — the world
 * never shows an empty NPC (principle #2). Non-Suspense TextureLoader,
 * matching PlayerAvatar's pattern.
 *
 * Click fires onClick (GameWorld wires this to setActiveNPC → D4 overlay).
 */

const SPRITE_FRAMES = 4;
const SPRITE_FPS = 5;

interface NPCProps {
  persona: NPCPersona;
  position: [number, number, number];
  playerPosition?: THREE.Vector3;
  onClick: () => void;
}

const QUAD_WIDTH = 1.2;
const QUAD_HEIGHT = 1.6;
const NAMEPLATE_OFFSET = QUAD_HEIGHT / 2 + 0.5;
// P10: how close before the NPC visually "notices" the player (bob + "!"
// indicator above head). Matches the keyboard-interact range felt in
// playtest so the cue arrives just before the prompt would.
const NOTICE_RANGE = 5.5;

// Hue from slug → consistent color per NPC, deterministic across sessions.
function slugToHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) % 360;
  }
  return Math.abs(h);
}

export default function NPC({ persona, position, playerPosition, onClick }: NPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [noticed, setNoticed] = useState(false);
  // P10: per-frame bob clock + smoothed proximity factor (0 = far, 1 = next
  // to the NPC). Drives idle bob amplitude so the NPC subtly leans in as
  // the player approaches.
  const clockRef = useRef(0);
  const proxRef = useRef(0);

  // Ground-sample y at mount (and lock in). Wander is intentionally skipped
  // this sprint per scope — static NPCs are fine, polish later.
  const grounded: [number, number, number] = useMemo(() => {
    return [position[0], getTerrainHeight(position[0], position[2]), position[2]];
  }, [position]);

  const hue = useMemo(() => slugToHue(persona.slug), [persona.slug]);
  const fillColor = useMemo(() => `hsl(${hue}, 50%, 60%)`, [hue]);
  const rimColor = useMemo(() => `hsl(${hue}, 55%, 35%)`, [hue]);

  // Sprite sheet: loaded imperatively (non-Suspense) so a missing file can
  // never blank the NPC. The same texture object lives in BOTH state and a
  // ref: JSX reads the state (refs can't be read in render), the useFrame
  // animation mutates through the ref (state values can't be mutated) —
  // each React Compiler rule sees only its legal access path.
  const spriteTexRef = useRef<THREE.Texture | null>(null);
  const [spriteTex, setSpriteTex] = useState<THREE.Texture | null>(null);
  const frameRef = useRef(0);
  useEffect(() => {
    if (!persona.sprite_url) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      persona.sprite_url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(1 / SPRITE_FRAMES, 1);
        spriteTexRef.current = tex;
        setSpriteTex(tex);
      },
      undefined,
      () => {
        /* load error → keep the hue-quad fallback */
      }
    );
    return () => {
      cancelled = true;
      spriteTexRef.current?.dispose();
      spriteTexRef.current = null;
    };
  }, [persona.sprite_url]);

  // Smooth hover scale + idle bob + proximity reaction.
  useFrame((_, delta) => {
    clockRef.current += delta;

    // Distance to player (XZ only — bob is vertical, not 3D).
    let dist = Infinity;
    if (playerPosition) {
      const dx = playerPosition.x - grounded[0];
      const dz = playerPosition.z - grounded[2];
      dist = Math.hypot(dx, dz);
    }
    const targetProx = THREE.MathUtils.clamp(1 - dist / NOTICE_RANGE, 0, 1);
    proxRef.current = THREE.MathUtils.damp(proxRef.current, targetProx, 8, delta);
    const isNoticed = dist <= NOTICE_RANGE;
    if (isNoticed !== noticed) setNoticed(isNoticed);

    if (meshRef.current) {
      // Hover takes precedence over notice scale; both feel like attention.
      const scaleTarget = hovered ? 1.05 : 1 + proxRef.current * 0.04;
      const next = THREE.MathUtils.damp(meshRef.current.scale.x, scaleTarget, 12, delta);
      meshRef.current.scale.set(next, next, next);
    }

    // Idle bob: gentle when alone (amp 0.04), bigger when player is near
    // (up to 0.12). Slower freq than the player to feel "watching".
    if (groupRef.current) {
      const amp = 0.04 + proxRef.current * 0.08;
      const bob = Math.sin(clockRef.current * Math.PI * 1.8) * amp;
      groupRef.current.position.y = grounded[1] + bob;
    }

    // Sprite idle animation: step through the 4 frames at SPRITE_FPS.
    const tex = spriteTexRef.current;
    if (tex) {
      const frame = Math.floor(clockRef.current * SPRITE_FPS) % SPRITE_FRAMES;
      if (frame !== frameRef.current) {
        frameRef.current = frame;
        tex.offset.x = frame / SPRITE_FRAMES;
      }
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "auto";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <group ref={groupRef} position={grounded}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* P25: soft warm glow that fades in when player is near. Sits
            behind the rim + fill, larger and faded so it reads as a halo
            rather than a hard outline. Opacity tied to noticed state. */}
        {noticed && (
          <mesh position={[0, QUAD_HEIGHT / 2, -0.005]}>
            <planeGeometry args={[QUAD_WIDTH + 0.9, QUAD_HEIGHT + 0.9]} />
            <meshBasicMaterial
              color="#FFE9B5"
              transparent
              opacity={0.28}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
        {spriteTex ? (
          /* Pixel-art idle sprite. Square quad (frames are 16x16); sits with
             feet at ground. The sheet's own silhouette replaces the rim. */
          <mesh
            ref={meshRef}
            position={[0, QUAD_HEIGHT / 2, 0]}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <planeGeometry args={[QUAD_HEIGHT, QUAD_HEIGHT]} />
            <meshBasicMaterial
              map={spriteTex}
              transparent
              alphaTest={0.05}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : (
          <>
            {/* Rim (slightly larger, darker — sits behind fill) */}
            <mesh position={[0, QUAD_HEIGHT / 2, -0.001]}>
              <planeGeometry args={[QUAD_WIDTH + 0.08, QUAD_HEIGHT + 0.08]} />
              <meshBasicMaterial
                color={rimColor}
                transparent
                opacity={0.9}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {/* Fill quad — clickable */}
            <mesh
              ref={meshRef}
              position={[0, QUAD_HEIGHT / 2, 0]}
              onClick={handleClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
            >
              <planeGeometry args={[QUAD_WIDTH, QUAD_HEIGHT]} />
              <meshBasicMaterial
                color={fillColor}
                transparent
                opacity={hovered ? 1 : 0.95}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </>
        )}
      </Billboard>

      {/* Ground shadow disc — keeps NPCs grounded visually */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[QUAD_WIDTH * 0.45, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>

      {/* P10: notice indicator — appears when player enters NOTICE_RANGE.
          A subtle "!" bubble that signals "I see you, click to talk".
          Mounted/unmounted by `noticed` state so animations restart cleanly. */}
      {noticed && (
        <Html zIndexRange={[40, 0]}
          position={[0, NAMEPLATE_OFFSET + QUAD_HEIGHT + 0.7, 0]}
          center
          style={{ pointerEvents: "none" }}
          distanceFactor={10}
        >
          <div
            style={{
              background: "#FFD166",
              color: "#1A1410",
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 800,
              fontSize: "16px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
              animation: "npcNoticeBounce 700ms ease-in-out infinite",
              userSelect: "none",
            }}
          >
            !
          </div>
          <style jsx>{`
            @keyframes npcNoticeBounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
          `}</style>
        </Html>
      )}

      {/* Nameplate */}
      <Html zIndexRange={[40, 0]}
        position={[0, NAMEPLATE_OFFSET + QUAD_HEIGHT, 0]}
        center
        style={{ pointerEvents: "none" }}
        distanceFactor={10}
      >
        <div
          className="whitespace-nowrap text-center"
          style={{
            background: "rgba(15, 15, 16, 0.7)",
            padding: "2px 8px",
            borderRadius: "4px",
            border: hovered ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#f1ffff",
              fontFamily: "'IBM Plex Mono', monospace",
              lineHeight: 1.2,
            }}
          >
            {persona.display_name}
          </div>
        </div>
      </Html>
    </group>
  );
}
