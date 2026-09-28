"use client";

import { Suspense, useRef, useState, useMemo, useEffect, type RefObject } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import Character, { CHARACTER_HEIGHT, type CharacterMotion } from "./character/Character";
import { hashSeed, randomLook, seeded } from "@/lib/game/character/look";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { AudioManager } from "@/lib/game/audio";
import type { NPCPersona } from "@/lib/content/types";


/**
 * NPC (sprint D5) — a resident on the shared character rig (row 105). Until
 * the resident roster exists each persona wears a random look seeded by its
 * slug, so the same resident always looks the same. Wandering drives the
 * walk clip; a greeting (tsi:npc-greet) plays Wave.
 *
 * Click fires onClick (GameWorld wires this to setActiveNPC → D4 overlay).
 */

interface NPCProps {
  persona: NPCPersona;
  position: [number, number, number];
  playerPosition?: THREE.Vector3;
  playerPositionRef?: RefObject<THREE.Vector3>;
  worldPositionRef?: RefObject<THREE.Vector3>;
  groundHeight?: (x: number, z: number) => number;
  constrainMove?: (x: number, z: number, nx: number, nz: number) => [number, number];
  onClick: () => void;
}

const NAMEPLATE_OFFSET = CHARACTER_HEIGHT + 0.3;
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

export default function NPC({ persona, position, playerPosition, playerPositionRef, worldPositionRef, groundHeight = getTerrainHeight, constrainMove, onClick }: NPCProps) {
  const groupRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [noticed, setNoticed] = useState(false);
  // G2 speech bubble state + timers (refs so useFrame can read/write freely).
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleUntilRef = useRef(0);
  const bubbleCooldownRef = useRef(0);
  const voiceTimers = useRef<number[]>([]);
  useEffect(() => () => { voiceTimers.current.forEach(window.clearTimeout); }, []);
  // P10: per-frame bob clock + smoothed proximity factor (0 = far, 1 = next
  // to the NPC). Drives idle bob amplitude so the NPC subtly leans in as
  // the player approaches.
  const clockRef = useRef(0);
  const proxRef = useRef(0);
  // Loop iter 8 (2026-07-24): greeting hop — when a chat opens with this
  // NPC (tsi:npc-greet {id}), fire the same hop as the startle. Cheap
  // delight: they bounce hello as the overlay slides in.
  useEffect(() => {
    const onGreet = (e: Event) => {
      const d = (e as CustomEvent<{ id: string }>).detail;
      if (d?.id === persona.id) greetAtRef.current = performance.now();
    };
    window.addEventListener("tsi:npc-greet", onGreet);
    return () => window.removeEventListener("tsi:npc-greet", onGreet);
  }, [persona.id]);

  // G4 (item 8): startle hop when the player barges in close — a little
  // 0.35s bounce with a 3s cooldown.
  const hopRef = useRef({ t: -1, cooldownUntil: 0 });
  // Greet hop trigger: listener stamps the time; the frame loop only READS
  // it (react-compiler forbids frame-writes to effect-shared refs) — the
  // 150ms window + the hop.t latch make it one-shot.
  const greetAtRef = useRef(0);

  // Spawn base (XZ). W1: the NPC wanders around this within WANDER_RADIUS.
  const grounded: [number, number, number] = useMemo(() => {
    return [position[0], groundHeight(position[0], position[2]), position[2]];
  }, [position, groundHeight]);
  // Deterministic per-NPC wander phase from the slug hash.
  const wanderPhase = useMemo(() => slugToHue(persona.slug) * 0.017, [persona.slug]);

  const look = useMemo(() => randomLook(seeded(hashSeed(persona.slug))), [persona.slug]);
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });

  // Daily village life v1: the anchor eases toward the (phase-dependent)
  // spawn base so a time-of-day move reads as a slow stroll, not a snap.
  const easedBaseRef = useRef<[number, number] | null>(null);

  // Smooth hover scale + idle bob + proximity reaction + W1 wander.
  useFrame((_, delta) => {
    clockRef.current += delta;

    if (!easedBaseRef.current) easedBaseRef.current = [grounded[0], grounded[2]];
    const eb = easedBaseRef.current;
    eb[0] = THREE.MathUtils.damp(eb[0], grounded[0], 0.55, delta);
    eb[1] = THREE.MathUtils.damp(eb[1], grounded[2], 0.55, delta);

    // W1: current wandered XZ around the (eased) spawn base.
    const [wx, wz] = wanderOffset(clockRef.current, wanderPhase);
    const [curX, curZ] = constrainMove
      ? constrainMove(grounded[0], grounded[2], eb[0] + wx, eb[1] + wz)
      : [eb[0] + wx, eb[1] + wz];

    // Distance to player uses the wandered position (XZ only).
    let dist = Infinity;
    const player = playerPositionRef?.current ?? playerPosition;
    if (player) {
      const dx = player.x - curX;
      const dz = player.z - curZ;
      dist = Math.hypot(dx, dz);
    }
    const targetProx = THREE.MathUtils.clamp(1 - dist / NOTICE_RANGE, 0, 1);
    proxRef.current = THREE.MathUtils.damp(proxRef.current, targetProx, 8, delta);
    const isNoticed = dist <= NOTICE_RANGE;
    if (isNoticed !== noticed) setNoticed(isNoticed);

    // G4 startle hop trigger.
    const hop = hopRef.current;
    const greeted = performance.now() - greetAtRef.current < 150;
    if (greeted && hop.t < 0) {
      hop.t = 0;
      hop.cooldownUntil = clockRef.current + 2;
      motion.current.play = "Wave";
    }
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
      voiceTimers.current.forEach(window.clearTimeout);
      voiceTimers.current = [140, 300].map((delay) => window.setTimeout(() => AudioManager.playBlip(), delay));
    }
    if (bubble && now > bubbleUntilRef.current) setBubble(null);

    if (visualRef.current) {
      // Hover takes precedence over notice scale; both feel like attention.
      const scaleTarget = hovered ? 1.05 : 1 + proxRef.current * 0.04;
      const next = THREE.MathUtils.damp(visualRef.current.scale.x, scaleTarget, 12, delta);
      visualRef.current.scale.set(next, next, next);
    }

    // Idle bob + W1 wander drift. XZ eases to the wandered spot; y resamples
    // terrain there (+ bob) so the NPC stays grounded on slopes.
    if (groupRef.current) {
      const g = groupRef.current, m = motion.current;
      const step = Math.hypot(curX - g.position.x, curZ - g.position.z);
      m.speed = delta > 0 ? step / delta : 0;
      // Face the way they stroll; turn to the player once noticed and still.
      const heading = isNoticed && player ? Math.atan2(player.x - curX, player.z - curZ) : step > 1e-4 ? Math.atan2(curX - g.position.x, curZ - g.position.z) : m.yaw;
      m.yaw += Math.atan2(Math.sin(heading - m.yaw), Math.cos(heading - m.yaw)) * Math.min(1, delta * 6);
      m.lift = hopY;
      g.position.set(curX, groundHeight(curX, curZ), curZ);
      worldPositionRef?.current.copy(g.position);
    }
  }, -3);

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
    e.nativeEvent.preventDefault();
    onClick();
  };

  return (
    <group ref={groupRef} position={grounded}>
      <group ref={visualRef}>
      <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <Suspense fallback={null}><Character look={look} motion={motion} walkSpeed={2} /></Suspense>
      </group>

      {/* G2: proximity speech bubble — ACNH-style rounded white bubble with
          a tail, floating above the nameplate. Pointer-events off so it
          never blocks the click-to-chat hitbox. */}
      {bubble && (
        <Html calculatePosition={calculateCurvedHtmlPosition}
          zIndexRange={[40, 0]}
          position={[0, NAMEPLATE_OFFSET + 0.95, 0]}
          center
          style={{ pointerEvents: "none" }}
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
      {noticed && !bubble && (
        <Html calculatePosition={calculateCurvedHtmlPosition} zIndexRange={[40, 0]}
          position={[0, NAMEPLATE_OFFSET + 0.65, 0]}
          center
          style={{ pointerEvents: "none" }}
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
      <Html calculatePosition={calculateCurvedHtmlPosition} zIndexRange={[40, 0]}
        position={[0, NAMEPLATE_OFFSET, 0]}
        center
        style={{ pointerEvents: "none" }}
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
              fontSize: "11px",
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
    </group>
  );
}
