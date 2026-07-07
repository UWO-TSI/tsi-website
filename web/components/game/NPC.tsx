"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { getBlobTexture } from "./BlobShadows";
import { AudioManager } from "@/lib/game/audio";
import type { NPCPersona } from "@/lib/game/contentTypes";

/**
 * NPC (sprint D5; sprites landed 2026-07-03 cozy push) — billboard for a
 * non-player character.
 *
 * With `persona.sprite_url` set, renders the front-facing cell of a 64x16
 * Ninja Adventure CC0 idle sheet (columns are DIRECTIONS, not frames) with
 * NearestFilter. Falls back to the original hue-hashed quad while
 * the texture loads, on load error, or when sprite_url is null — the world
 * never shows an empty NPC (principle #2). Non-Suspense TextureLoader,
 * matching PlayerAvatar's pattern.
 *
 * Click fires onClick (GameWorld wires this to setActiveNPC → D4 overlay).
 */

const SPRITE_FRAMES = 4; // sheet columns (directions); front face = column 0

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

// G2 (cozy marathon): proximity speech bubble. On the noticed rising edge
// the NPC greets with a floating line + voice blips — the ACNH "villagers
// talk at you as you pass" beat. Once per approach, cooled down so
// loitering nearby doesn't spam.
const BUBBLE_MS = 4200;
const BUBBLE_COOLDOWN_S = 22;
// Fillers (no canned_dialogue) draw from a cozy pool. Original lines, gently
// TSI-flavored so the courtyard feels lived-in without naming real people.
const FILLER_LINES = [
  "Nice day, eh?",
  "Hm hm hmm ♪",
  "The bridge creaks a little. I like it.",
  "Have you talked to the Mayor yet?",
  "I could watch the river all day.",
  "New folks keep arriving. It's good to see.",
  "The fireflies come out by the water at night.",
  "Someone shook the whole tree bare this morning!",
  "If you're building something, the HQ's the place.",
  "I caught a little one down by the bank earlier.",
  "The flowers grow back if you're patient.",
  "Feels like the whole village is waking up lately.",
  "Pull up a bench, stay a while.",
  "Heard the Oracle knows what class you'll be.",
  "Quiet mornings are my favorite kind.",
];

// Hue from slug → consistent color per NPC, deterministic across sessions.
function slugToHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) % 360;
  }
  return Math.abs(h);
}

// W1: gentle wander. Each NPC drifts within WANDER_RADIUS of its spawn on two
// slow, coprime-ish sine components (so the path never repeats tightly), with
// a slower "pause" envelope that eases the drift toward 0 periodically — the
// ACNH "villager mills about, then stops to look around" feel. The billboard
// nameplate, speech bubble, and click hitbox all ride the group, so they
// follow for free. Radius is small enough to stay clear of buildings.
const WANDER_RADIUS = 1.15;
function wanderOffset(t: number, phase: number): [number, number] {
  const pause = 0.5 + 0.5 * Math.sin(t * 0.11 + phase); // 0..1 slow envelope
  const amp = WANDER_RADIUS * pause;
  const x = Math.sin(t * 0.23 + phase) * amp;
  const z = Math.sin(t * 0.31 + phase * 1.7) * amp * 0.8;
  return [x, z];
}

export default function NPC({ persona, position, playerPosition, onClick }: NPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [noticed, setNoticed] = useState(false);
  // G2 speech bubble state + timers (refs so useFrame can read/write freely).
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleUntilRef = useRef(0);
  const bubbleCooldownRef = useRef(0);
  // P10: per-frame bob clock + smoothed proximity factor (0 = far, 1 = next
  // to the NPC). Drives idle bob amplitude so the NPC subtly leans in as
  // the player approaches.
  const clockRef = useRef(0);
  const proxRef = useRef(0);
  // G4 (item 8): startle hop when the player barges in close — a little
  // 0.35s bounce with a 3s cooldown.
  const hopRef = useRef({ t: -1, cooldownUntil: 0 });

  // Spawn base (XZ). W1: the NPC wanders around this within WANDER_RADIUS.
  const grounded: [number, number, number] = useMemo(() => {
    return [position[0], getTerrainHeight(position[0], position[2]), position[2]];
  }, [position]);
  // Deterministic per-NPC wander phase from the slug hash.
  const wanderPhase = useMemo(() => slugToHue(persona.slug) * 0.017, [persona.slug]);

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

  // Smooth hover scale + idle bob + proximity reaction + W1 wander.
  useFrame((_, delta) => {
    clockRef.current += delta;

    // W1: current wandered XZ around the spawn base.
    const [wx, wz] = wanderOffset(clockRef.current, wanderPhase);
    const curX = grounded[0] + wx;
    const curZ = grounded[2] + wz;

    // Distance to player uses the wandered position (XZ only).
    let dist = Infinity;
    if (playerPosition) {
      const dx = playerPosition.x - curX;
      const dz = playerPosition.z - curZ;
      dist = Math.hypot(dx, dz);
    }
    const targetProx = THREE.MathUtils.clamp(1 - dist / NOTICE_RANGE, 0, 1);
    proxRef.current = THREE.MathUtils.damp(proxRef.current, targetProx, 8, delta);
    const isNoticed = dist <= NOTICE_RANGE;
    if (isNoticed !== noticed) setNoticed(isNoticed);

    // G4 startle hop trigger.
    const hop = hopRef.current;
    if (dist < 1.05 && hop.t < 0 && clockRef.current > hop.cooldownUntil) {
      hop.t = 0;
      hop.cooldownUntil = clockRef.current + 3;
    }
    let hopY = 0;
    if (hop.t >= 0) {
      hop.t += delta;
      if (hop.t > 0.35) hop.t = -1;
      else hopY = Math.sin((hop.t / 0.35) * Math.PI) * 0.38;
    }

    // G2: greet on the noticed rising edge (with cooldown), clear on expiry.
    const now = clockRef.current;
    if (isNoticed && !noticed && now >= bubbleCooldownRef.current) {
      const pool =
        persona.canned_dialogue && persona.canned_dialogue.length > 0
          ? persona.canned_dialogue
          : FILLER_LINES;
      const line = pool[Math.floor(Math.random() * pool.length)];
      bubbleUntilRef.current = now + BUBBLE_MS / 1000;
      bubbleCooldownRef.current = now + BUBBLE_COOLDOWN_S;
      setBubble(line);
      // A couple of staggered voice blips sell the "they said something".
      AudioManager.playBlip();
      window.setTimeout(() => AudioManager.playBlip(), 140);
      window.setTimeout(() => AudioManager.playBlip(), 300);
    }
    if (bubble && now > bubbleUntilRef.current) setBubble(null);

    if (meshRef.current) {
      // Hover takes precedence over notice scale; both feel like attention.
      const scaleTarget = hovered ? 1.05 : 1 + proxRef.current * 0.04;
      const next = THREE.MathUtils.damp(meshRef.current.scale.x, scaleTarget, 12, delta);
      meshRef.current.scale.set(next, next, next);
    }

    // Idle bob + W1 wander drift. XZ eases to the wandered spot; y resamples
    // terrain there (+ bob) so the NPC stays grounded on slopes.
    if (groupRef.current) {
      const amp = 0.04 + proxRef.current * 0.08;
      const bob = Math.sin(clockRef.current * Math.PI * 1.8) * amp;
      const gy = getTerrainHeight(curX, curZ);
      groupRef.current.position.set(curX, gy + bob + hopY, curZ);
    }

    // Idle sheets put DIRECTIONS in columns (down/up/left/right), not
    // animation frames — cycling them made NPCs spin in place (2026-07-04
    // layout audit). Pin the front-facing column; the bob is the idle life.
    const tex = spriteTexRef.current;
    if (tex && tex.offset.x !== 0) tex.offset.x = 0;
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
      {/* Art pass 2026-07-07: New Leaf blob shadow (shadow maps are gone). */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[0.8, 0.55]} />
        <meshBasicMaterial map={getBlobTexture()} transparent opacity={0.3} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
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

      {/* G2: proximity speech bubble — ACNH-style rounded white bubble with
          a tail, floating above the nameplate. Pointer-events off so it
          never blocks the click-to-chat hitbox. */}
      {bubble && (
        <Html
          zIndexRange={[40, 0]}
          position={[0, NAMEPLATE_OFFSET + QUAD_HEIGHT + 0.6, 0]}
          center
          style={{ pointerEvents: "none" }}
          distanceFactor={10}
        >
          <div
            style={{
              position: "relative",
              maxWidth: 210,
              padding: "8px 12px",
              background: "#FFFDF5",
              color: "#4A4034",
              borderRadius: 14,
              border: "2px solid #E8DFC8",
              fontFamily: "var(--font-highlight, sans-serif)",
              fontSize: 12,
              lineHeight: 1.35,
              textAlign: "center",
              boxShadow: "0 3px 10px rgba(60, 45, 20, 0.18)",
              animation: "npc-bubble-pop 0.25s ease-out",
              whiteSpace: "normal",
              width: "max-content",
            }}
          >
            {bubble}
            <span
              style={{
                position: "absolute",
                left: "50%",
                bottom: -7,
                transform: "translateX(-50%) rotate(45deg)",
                width: 12,
                height: 12,
                background: "#FFFDF5",
                borderRight: "2px solid #E8DFC8",
                borderBottom: "2px solid #E8DFC8",
              }}
            />
            <style>{`
              @keyframes npc-bubble-pop {
                from { transform: scale(0.6); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        </Html>
      )}

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

      {/* Nameplate — proximity-gated (art pass pt2): always-on plates over
          every NPC read as map clutter; they reveal alongside the greeting. */}
      {(noticed || hovered) && (
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
      )}
    </group>
  );
}
