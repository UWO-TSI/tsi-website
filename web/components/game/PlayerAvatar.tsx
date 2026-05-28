"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { useSFX } from "@/lib/game/useAudio";
import MoveTargetIndicator from "./MoveTargetIndicator";
import type { EmoteType } from "@/lib/game/contentTypes";

// Sprint E3: animation_key → emoji glyph for the Html overlay. Real sprite
// swaps land when avatar sprites do; this is the placeholder.
const EMOTE_EMOJI: Record<string, string> = {
  wave: "👋",
  dance: "🕺",
  laugh: "😂",
  point: "👉",
  sit: "🪑",
};

/**
 * PlayerAvatar — 2D sprite on Billboard in 3D world (Dave the Diver style)
 *
 * Uses a sprite sheet loaded from /assets/characters/prototype_character.png
 * UV offset/repeat used to crop one frame at a time.
 * Frame cycling in useFrame for walk animation.
 *
 * Sprite sheet layout (estimated from prototype):
 *   Rows 0-1: front idle (2 frames)
 *   Rows 2-3: front walk (3 frames)
 *   Rows 4-5: side (2-3 frames)
 *   Rows 6+: back/other directions
 *
 * Configurable via SHEET_COLS/SHEET_ROWS constants.
 */

const PLAYER_SPEED = 5;
const BOUNDARY = 38;
const ROTATION_LERP = 10;
// Sprint A1: damp time for y-axis ground follow. Lower = snappier, higher
// = more sluggish. 0.05s keeps the avatar responsive but smooths slope
// transitions so there's no per-frame popping.
const Y_DAMP_TIME = 0.05;
const AVATAR_FOOT_OFFSET = 0;

// Sprint A8: visual bob constants. Applied to the sprite mesh inside the
// Billboard, NOT the group (group.y is ground-follow from A1).
const SPRITE_BASE_Y = 0.8;
const WALK_BOB_AMP = 0.05;
const IDLE_BOB_AMP = 0.02;
const BREATH_BLEND_LERP = 1 / 0.3; // ~0.3s blend between walk and idle bob

// Sprite sheet grid config — adjust when exact sheet layout is confirmed
const SHEET_COLS = 3;
const SHEET_ROWS = 10;
const FRAME_RATE = 6; // frames per second for walk animation

// Direction rows in sprite sheet (approximate — tune to actual sheet)
const DIR_DOWN = { row: 0, frames: 2 };
const DIR_LEFT = { row: 4, frames: 2 };
const DIR_RIGHT = { row: 6, frames: 1 };
const DIR_UP = { row: 8, frames: 2 };
const WALK_DOWN = { row: 2, frames: 3 };
const WALK_LEFT = { row: 4, frames: 3 };
const WALK_RIGHT = { row: 6, frames: 3 };
const WALK_UP = { row: 8, frames: 3 };

// Key state tracking
const keys: Record<string, boolean> = {};

interface PlayerAvatarProps {
  spawnPosition: [number, number, number];
  onMove: (position: THREE.Vector3) => void;
  playerName?: string;
  playerLevel?: number;
  activeEmote?: EmoteType | null;
}

export default function PlayerAvatar({ spawnPosition, onMove, playerName = "Player", playerLevel = 1, activeEmote = null }: PlayerAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  // Initialize y on the terrain at spawn so the avatar doesn't visibly
  // drop in from y=0 if the spawn point sits on a slope.
  const positionRef = useRef(new THREE.Vector3(
    spawnPosition[0],
    getTerrainHeight(spawnPosition[0], spawnPosition[2]) + AVATAR_FOOT_OFFSET,
    spawnPosition[2],
  ));
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const facingRef = useRef(0);
  const frameTimer = useRef(0);
  const currentFrame = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const { camera, gl } = useThree();
  const sfx = useSFX();
  const footstepTimer = useRef(0);
  // Sprint A8: breath blend (0 = walking bob, 1 = idle bob), elapsed clock for
  // sine drivers, and active click-to-move ring indicators.
  const breathBlendRef = useRef(0);
  const clockRef = useRef(0);
  const indicatorIdRef = useRef(0);
  const [indicators, setIndicators] = useState<Array<{ id: number; position: [number, number, number] }>>([]);

  // Load and configure textures for pixel art during construction
  const spriteTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/assets/characters/prototype_character.png");
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);
    tex.offset.set(0, 1 - 1 / SHEET_ROWS);
    return tex;
  }, []);

  const shadowTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/assets/characters/static_shadow.png");
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }, []);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Click-to-move
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);
      const intersection = new THREE.Vector3();
      raycaster.current.ray.intersectPlane(groundPlane.current, intersection);

      if (intersection) {
        intersection.x = THREE.MathUtils.clamp(intersection.x, -BOUNDARY, BOUNDARY);
        intersection.z = THREE.MathUtils.clamp(intersection.z, -BOUNDARY, BOUNDARY);
        intersection.y = 0;
        targetRef.current = intersection;
        // Sprint A8: spawn expanding ring at click point. Re-clicks spawn new
        // rings (key by counter so React mounts a fresh component).
        const id = indicatorIdRef.current++;
        setIndicators((prev) => [
          ...prev,
          { id, position: [intersection.x, 0, intersection.z] },
        ]);
      }
    },
    [camera, gl]
  );

  useEffect(() => {
    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [gl, handleClick]);

  // Movement + sprite animation loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    clockRef.current += delta;
    const pos = positionRef.current;
    const prevX = pos.x;
    const prevZ = pos.z;
    const moveDir = new THREE.Vector3();
    let moving = false;

    // WASD / Arrow input
    if (keys["w"] || keys["arrowup"]) { moveDir.z += 1; moving = true; }
    if (keys["s"] || keys["arrowdown"]) { moveDir.z -= 1; moving = true; }
    if (keys["a"] || keys["arrowleft"]) { moveDir.x += 1; moving = true; }
    if (keys["d"] || keys["arrowright"]) { moveDir.x -= 1; moving = true; }

    if (moving) {
      targetRef.current = null;
      moveDir.normalize();
    }

    // Click-to-move
    if (!moving && targetRef.current) {
      const toTarget = targetRef.current.clone().sub(pos);
      toTarget.y = 0;
      if (toTarget.length() > 0.3) {
        moveDir.copy(toTarget.normalize());
        moving = true;
      } else {
        targetRef.current = null;
      }
    }

    // Apply XZ movement
    if (moving) {
      const step = PLAYER_SPEED * delta;
      pos.x += moveDir.x * step;
      pos.z += moveDir.z * step;
      pos.x = THREE.MathUtils.clamp(pos.x, -BOUNDARY, BOUNDARY);
      pos.z = THREE.MathUtils.clamp(pos.z, -BOUNDARY, BOUNDARY);

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      facingRef.current = THREE.MathUtils.lerp(
        facingRef.current,
        targetAngle,
        ROTATION_LERP * delta
      );
    }

    // Ground follow — sample terrain every frame (even when idle so the
    // avatar settles if terrain ever changes) and damp toward it. Damping
    // keeps slope transitions smooth instead of snapping per step.
    const targetY = getTerrainHeight(pos.x, pos.z) + AVATAR_FOOT_OFFSET;
    pos.y = THREE.MathUtils.damp(pos.y, targetY, 1 / Y_DAMP_TIME, delta);

    // Determine direction for sprite sheet
    const angle = facingRef.current;
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    let anim = moving ? WALK_DOWN : DIR_DOWN;
    if (normalizedAngle > Math.PI * 0.25 && normalizedAngle <= Math.PI * 0.75) {
      anim = moving ? WALK_LEFT : DIR_LEFT;
    } else if (normalizedAngle > Math.PI * 0.75 && normalizedAngle <= Math.PI * 1.25) {
      anim = moving ? WALK_UP : DIR_UP;
    } else if (normalizedAngle > Math.PI * 1.25 && normalizedAngle <= Math.PI * 1.75) {
      anim = moving ? WALK_RIGHT : DIR_RIGHT;
    }

    // Frame cycling — Sprint A8: scale rate by actual XZ movement speed so
    // boundary-clamped or slow approach drags the cycle down proportionally.
    if (moving) {
      const dx = pos.x - prevX;
      const dz = pos.z - prevZ;
      const actualSpeed = delta > 0 ? Math.hypot(dx, dz) / delta : 0;
      const speedRatio = THREE.MathUtils.clamp(actualSpeed / PLAYER_SPEED, 0, 1);
      const effectiveRate = FRAME_RATE * speedRatio;
      frameTimer.current += delta;
      if (effectiveRate > 0 && frameTimer.current > 1 / effectiveRate) {
        frameTimer.current = 0;
        currentFrame.current = (currentFrame.current + 1) % anim.frames;
      }
    } else {
      currentFrame.current = 0;
      frameTimer.current = 0;
    }

    // Update UV offset to show current frame
    const col = currentFrame.current % SHEET_COLS;
    const row = anim.row;
    spriteTexture.offset.set(
      col / SHEET_COLS,
      1 - (row + 1) / SHEET_ROWS
    );

    // Update position
    groupRef.current.position.copy(pos);

    // Sprint A8: walk bob (4Hz, 0.05) vs idle breathing (0.5Hz, 0.02), blended
    // smoothly via breathBlendRef over ~0.3s. Applied to sprite mesh y only so
    // the group's ground-follow y from A1 is untouched.
    const t = clockRef.current;
    const walkBob = Math.sin(t * Math.PI * 8) * WALK_BOB_AMP;
    const idleBob = Math.sin(t * Math.PI) * IDLE_BOB_AMP;
    const blendTarget = moving ? 0 : 1;
    breathBlendRef.current = THREE.MathUtils.lerp(
      breathBlendRef.current,
      blendTarget,
      THREE.MathUtils.clamp(BREATH_BLEND_LERP * delta, 0, 1)
    );
    const bobY = THREE.MathUtils.lerp(walkBob, idleBob, breathBlendRef.current);
    if (meshRef.current) {
      meshRef.current.position.y = SPRITE_BASE_Y + bobY;
    }

    // Footstep SFX — fire ~every 0.4s while walking. No-op if audio is muted
    // or assets aren't shipped (manager silently drops the call).
    if (moving) {
      footstepTimer.current += delta;
      if (footstepTimer.current >= 0.4) {
        footstepTimer.current = 0;
        sfx.play("footstep");
      }
    } else {
      footstepTimer.current = 0;
    }

    if (moving !== isMoving) setIsMoving(moving);
    // Notify camera/parent when moving, or when y is still settling toward
    // the terrain (keeps camera in sync after stopping on a slope).
    const ySettling = Math.abs(pos.y - targetY) > 0.005;
    if (moving || ySettling) onMove(pos.clone());
  });

  return (
    <>
      {/* Sprint A8: click-to-move target indicators in world space */}
      {indicators.map((ind) => (
        <MoveTargetIndicator
          key={ind.id}
          position={ind.position}
          onComplete={() =>
            setIndicators((prev) => prev.filter((i) => i.id !== ind.id))
          }
        />
      ))}
      <group ref={groupRef} position={spawnPosition}>
      {/* Character sprite on billboard */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh ref={meshRef} position={[0, 0.8, 0]}>
          <planeGeometry args={[1.0, 1.4]} />
          <meshBasicMaterial
            map={spriteTexture}
            transparent
            alphaTest={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </Billboard>

      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[1.0, 1.0]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Sprint E3: active emote bubble above the avatar's head. Parent clears
          activeEmote after 3.5s so this just unmounts automatically. */}
      {activeEmote && (
        <Html
          position={[0, 2.6, 0]}
          center
          style={{ pointerEvents: "none" }}
          distanceFactor={10}
        >
          <div
            className="player-emote-bubble"
            style={{
              fontSize: 40,
              lineHeight: 1,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
              userSelect: "none",
            }}
          >
            {EMOTE_EMOJI[activeEmote.animation_key] ??
              activeEmote.display_name.charAt(0).toUpperCase()}
          </div>
          <style jsx>{`
            .player-emote-bubble {
              animation: playerEmoteBounce 600ms ease-in-out infinite;
            }
            @keyframes playerEmoteBounce {
              0% {
                transform: translateY(0) scale(1);
              }
              50% {
                transform: translateY(-6px) scale(1.08);
              }
              100% {
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </Html>
      )}

      {/* Nameplate */}
      <Html
        position={[0, 2.0, 0]}
        center
        style={{ pointerEvents: "none" }}
        distanceFactor={10}
      >
        <div
          className="whitespace-nowrap text-center"
          style={{
            background: "rgba(15, 15, 16, 0.6)",
            padding: "2px 8px",
            borderRadius: "4px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1ffff", lineHeight: 1.2 }}>
            {playerName}
          </div>
          <div style={{ fontSize: "12px", color: "#9ca3af", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.2 }}>
            Lv. {playerLevel}
          </div>
        </div>
      </Html>
      </group>
    </>
  );
}
