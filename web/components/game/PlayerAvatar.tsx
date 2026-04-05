"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";

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
}

export default function PlayerAvatar({ spawnPosition, onMove, playerName = "Player", playerLevel = 1 }: PlayerAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const positionRef = useRef(new THREE.Vector3(...spawnPosition));
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const facingRef = useRef(0);
  const frameTimer = useRef(0);
  const currentFrame = useRef(0);
  const [isMoving, setIsMoving] = useState(false);
  const { camera, gl } = useThree();

  // Load sprite sheet
  const spriteTexture = useTexture("/assets/characters/prototype_character.png");
  const shadowTexture = useTexture("/assets/characters/static_shadow.png");

  // Configure textures for pixel art
  useEffect(() => {
    spriteTexture.minFilter = THREE.NearestFilter;
    spriteTexture.magFilter = THREE.NearestFilter;
    spriteTexture.generateMipmaps = false;
    spriteTexture.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);
    spriteTexture.offset.set(0, 1 - 1 / SHEET_ROWS);
    spriteTexture.needsUpdate = true;

    shadowTexture.minFilter = THREE.NearestFilter;
    shadowTexture.magFilter = THREE.NearestFilter;
    shadowTexture.generateMipmaps = false;
    shadowTexture.needsUpdate = true;
  }, [spriteTexture, shadowTexture]);

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

    const pos = positionRef.current;
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

    // Apply movement
    if (moving) {
      const step = PLAYER_SPEED * delta;
      pos.x += moveDir.x * step;
      pos.z += moveDir.z * step;
      pos.x = THREE.MathUtils.clamp(pos.x, -BOUNDARY, BOUNDARY);
      pos.z = THREE.MathUtils.clamp(pos.z, -BOUNDARY, BOUNDARY);
      pos.y = getTerrainHeight(pos.x, pos.z);

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      facingRef.current = THREE.MathUtils.lerp(
        facingRef.current,
        targetAngle,
        ROTATION_LERP * delta
      );
    }

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

    // Frame cycling
    if (moving) {
      frameTimer.current += delta;
      if (frameTimer.current > 1 / FRAME_RATE) {
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

    if (moving !== isMoving) setIsMoving(moving);
    if (moving) onMove(pos.clone());
  });

  return (
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
  );
}
