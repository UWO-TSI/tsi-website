"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight, sampleTerrainHeightFast } from "./terrain";
import { clampToCoast } from "@/lib/game/coast";
import { useSFX } from "@/lib/game/useAudio";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";
import { pickCurvedGround } from "@/lib/game/groundPick";
import { juiceFovOffset } from "@/lib/game/cameraJuice";
import { getLabFov } from "@/lib/game/devLab";
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

const PLAYER_SPEED = 7.4; // refinement 2026-07-22 (David: walk felt slow) — was 6.3
// Organic coast (2026-07-14): the old ±50 SQUARE clamp let players walk
// diagonally onto open water. Radial clamp in coast-space instead — 50.6
// reaches the deck nose + damp sand, still short of the waterline (~51.4).
const BOUNDARY = 50.6;
const ROTATION_LERP = 10;
// Sprint A1: damp time for y-axis ground follow. Lower = snappier, higher
// = more sluggish. 0.05s keeps the avatar responsive but smooths slope
// transitions so there's no per-frame popping.
const Y_DAMP_TIME = 0.05;
const AVATAR_FOOT_OFFSET = 0;

// Sprint A8: visual bob constants. Applied to the sprite mesh inside the
// Billboard, NOT the group (group.y is ground-follow from A1).
const SPRITE_BASE_Y = 0.82; // square 1.45 plane: feet land at ~0.10 (art pass pt2: smaller avatar)
const WALK_BOB_AMP = 0.05;
const IDLE_BOB_AMP = 0.02;
const BREATH_BLEND_LERP = 1 / 0.3; // ~0.3s blend between walk and idle bob

// Sprite sheet grid — Ninja Adventure (CC0) Walk.png: 4 direction COLUMNS
// (down, up, left, right) x 4 walk-frame ROWS of 16x16. Idle = frame row 0
// of the facing column, so one texture covers everything.
const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const FRAME_RATE = 8; // frames per second for walk animation

// col = direction column; frames = walk cycle length (rows)
const DIR_DOWN = { col: 0, frames: 1 };
const DIR_UP = { col: 1, frames: 1 };
const DIR_LEFT = { col: 2, frames: 1 };
const DIR_RIGHT = { col: 3, frames: 1 };
const WALK_DOWN = { col: 0, frames: 4 };
const WALK_UP = { col: 1, frames: 4 };
const WALK_LEFT = { col: 2, frames: 4 };
const WALK_RIGHT = { col: 3, frames: 4 };

// Key state tracking
const keys: Record<string, boolean> = {};

// G1 camera feel: FOV widens a touch at sprint speed. Lives at module scope
// because the react-compiler treats three objects reached through hooks as
// frozen inside component code; a plain function call is the sanctioned
// escape hatch for imperative three mutations.
function applySprintFov(camera: THREE.Camera, speed: number, delta: number) {
  const pcam = camera as THREE.PerspectiveCamera;
  if (!pcam.isPerspectiveCamera) return;
  // Fishing micro-zoom (2026-07-23): juice offsets zoom IN on bite / MAX
  // CAST / reveal crack (decaying punch) and creep in during reel tension.
  // /lab/world camera bench can pin the base FOV; juice still applies on top.
  const targetFov = (getLabFov() ?? (speed > 9 ? 51 : 48)) - juiceFovOffset(delta);
  const nextFov = THREE.MathUtils.damp(pcam.fov, targetFov, 8, delta);
  if (Math.abs(nextFov - pcam.fov) > 0.01) {
    pcam.fov = nextFov;
    pcam.updateProjectionMatrix();
  }
}

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
  // G3: bench sitting. When set, movement freezes and the avatar snaps to the
  // seat with a down-facing idle pose. Toggled by tsi:sit window events from
  // GameWorld's E handler; any WASD/click input also stands.
  const sitRef = useRef<{ x: number; z: number } | null>(null);
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
  // P28: small dust puffs spawned at the player's feet on each footstep.
  // Each entry lives ~0.6s then unmounts itself.
  const puffIdRef = useRef(0);
  const [puffs, setPuffs] = useState<Array<{ id: number; position: [number, number, number]; scale?: number }>>([]);
  // Micro-anim loop iter 1 (2026-07-24): cozy sit beat — settle puff + a
  // brief contented ♪ over the head; standing gives a tiny hop.
  const [sitNote, setSitNote] = useState(false);
  const sitNoteTimerRef = useRef<number | null>(null);
  // F1.2: cosmetic jump. Space triggers a brief y-arc on the sprite mesh
  // (NOT the group — group y stays terrain-bound). Doesn't affect collision
  // or click-to-move pathing; pure visual delight.
  const jumpRef = useRef<{ active: boolean; t: number }>({ active: false, t: 0 });
  // Game-feel wave G1 (2026-07-07): velocity with accel/decel easing, screen-
  // space lean into motion, and a landing squash timer. Linear start/stop was
  // the last "slides like a cursor" tell in the handling.
  const velRef = useRef(new THREE.Vector2(0, 0));
  const leanRef = useRef(0);
  // Loop iter 6 (2026-07-24): turn-skid dust — a sharp direction reversal
  // at speed kicks a puff behind the feet. Cooldown stops puff spam.
  const skidCooldownRef = useRef(0);
  const squashRef = useRef(0);
  // G4 (item 7): after ~12s of standing still the sprite looks around —
  // left, right, then back to front — so idling reads alive (ACNH beat).
  const idleTimeRef = useRef(0);

  // Load and configure textures for pixel art during construction
  const spriteTexture = useMemo(() => {
    const tex = new THREE.TextureLoader().load("/assets/characters/player_walk.png");
    // L12 colorspace audit: sprite sheets are albedo — untagged they were
    // sampled as linear and rendered washed-bright vs everything else.
    tex.colorSpace = THREE.SRGBColorSpace;
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

  // Keyboard input. Sprint F1.1: track Shift for sprint multiplier and guard
  // against typing in inputs/textareas/contentEditable so WASD doesn't fire
  // while the user is filling out a form overlay.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return;
      keys[e.key.toLowerCase()] = true;
      if (e.key === "Shift") keys["shift"] = true;
      // F1.2: Space triggers cosmetic jump. Ignore key-repeat so holding
      // Space doesn't loop the arc — only re-fires after the previous
      // jump finishes.
      if (e.key === " " || e.code === "Space") {
        if (!e.repeat && !jumpRef.current.active) {
          jumpRef.current.active = true;
          jumpRef.current.t = 0;
        }
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
      if (e.key === "Shift") keys["shift"] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Click-to-move
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const handleClick = useCallback(
    (e: MouseEvent) => {
      // Refinement 2026-07-22 (David): click-to-move is touch-only now.
      // On fine-pointer devices misclicks kept sending the player walking;
      // WASD is the desktop verb. Coarse pointers (phones/tablets in full
      // 3D) keep tap-to-walk.
      if (window.matchMedia("(pointer: fine)").matches) return;
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);
      // 2026-07-08 sync fix: pick against the VISUALLY CURVED heightfield
      // (terrain height + world-bend), not a flat y=0 plane — clicks were
      // landing short of the point under the cursor.
      const intersection = pickCurvedGround(raycaster.current.ray, camera);

      if (intersection) {
        const [cix, ciz] = clampToCoast(intersection.x, intersection.z, BOUNDARY);
        intersection.x = cix;
        intersection.z = ciz;
        intersection.y = 0;
        targetRef.current = intersection;
        sfx.play("click");
        // Sprint A8: spawn expanding ring at click point. Re-clicks spawn new
        // rings (key by counter so React mounts a fresh component).
        const id = indicatorIdRef.current++;
        setIndicators((prev) => [
          ...prev,
          { id, position: [intersection.x, 0, intersection.z] },
        ]);
      }
    },
    [camera, gl, sfx]
  );

  useEffect(() => {
    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [gl, handleClick]);

  // G3: sit toggle. Same seat → stand; different/first → sit at that seat.
  useEffect(() => {
    const onSit = (e: Event) => {
      const { x, z } = (e as CustomEvent<{ x: number; z: number }>).detail;
      const cur = sitRef.current;
      const sittingDown = !(cur && cur.x === x && cur.z === z);
      sitRef.current = sittingDown ? { x, z } : null;
      if (sittingDown) {
        // settle: soft dust puff at the seat + ♪ for a moment
        const id = puffIdRef.current++;
        setPuffs((prev) => [...prev, { id, position: [x, getTerrainHeight(x, z) + 0.15, z], scale: 1.3 }]);
        setSitNote(true);
        if (sitNoteTimerRef.current) window.clearTimeout(sitNoteTimerRef.current);
        sitNoteTimerRef.current = window.setTimeout(() => setSitNote(false), 1700);
      } else {
        // stand: tiny cosmetic hop (reuses the jump arc at low amplitude)
        setSitNote(false);
        if (!jumpRef.current.active) jumpRef.current = { active: true, t: 0.22 };
      }
    };
    window.addEventListener("tsi:sit", onSit);
    return () => window.removeEventListener("tsi:sit", onSit);
  }, []);

  // Movement + sprite animation loop
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    clockRef.current += delta;
    const pos = positionRef.current;
    const prevX = pos.x;
    const prevZ = pos.z;
    let moving = false;
    let dx = 0;
    let dz = 0;

    // G3: any movement input stands up. Checked before the sit branch so a
    // held key breaks the pose immediately.
    if (sitRef.current && (keys["w"] || keys["a"] || keys["s"] || keys["d"] || targetRef.current)) {
      sitRef.current = null;
    }

    // G3: seated — snap to the bench seat, freeze, hold down-idle pose.
    if (sitRef.current) {
      const seat = sitRef.current;
      const seatY = sampleTerrainHeightFast(seat.x, seat.z) + AVATAR_FOOT_OFFSET;
      pos.set(seat.x, seatY, seat.z);
      groupRef.current.position.copy(pos);
      facingRef.current = Math.PI; // face the camera (down column, front cell)
      currentFrame.current = 0;
      spriteTexture.offset.set(DIR_DOWN.col / SHEET_COLS, 1 - 1 / SHEET_ROWS);
      if (meshRef.current) {
        // Lower the sprite so it reads as seated on the bench slats.
        meshRef.current.position.y = SPRITE_BASE_Y - 0.42;
      }
      velRef.current.set(0, 0);
      if (isMoving) setIsMoving(false);
      return;
    }

    // Sprint F1.1: camera-relative WASD. Forward = camera direction projected
    // onto XZ plane; right = forward rotated 90° clockwise. Arrow keys are
    // reserved for camera rotation (handled in GameWorld).
    const { fx, fz } = getCameraForwardXZ(camera);
    const rx = -fz;
    const rz = fx;
    const wDown = !!keys["w"];
    const sDown = !!keys["s"];
    const aDown = !!keys["a"];
    const dDown = !!keys["d"];
    const sprint = !!keys["shift"];
    if (wDown) { dx += fx; dz += fz; }
    if (sDown) { dx -= fx; dz -= fz; }
    if (dDown) { dx += rx; dz += rz; }
    if (aDown) { dx -= rx; dz -= rz; }
    const keyMoving = dx !== 0 || dz !== 0;
    if (keyMoving) {
      // Keyboard overrides click-to-move (Q3: keep click as alt, but keyboard
      // takes priority while keys are held).
      targetRef.current = null;
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      moving = true;
    }

    // Click-to-move — runs only when no keyboard input is active.
    if (!moving && targetRef.current) {
      const toTarget = targetRef.current.clone().sub(pos);
      toTarget.y = 0;
      if (toTarget.length() > 0.3) {
        toTarget.normalize();
        dx = toTarget.x;
        dz = toTarget.z;
        moving = true;
      } else {
        targetRef.current = null;
      }
    }

    // Apply XZ movement with easing (G1): velocity damps toward the input
    // direction — ~80ms up to speed, ~130ms glide-out. Frame cycling below
    // already scales by ACTUAL speed, so the walk anim eases in for free.
    {
      const speedMult = sprint && keyMoving ? 1.85 : 1; // refinement: stronger sprint (was 1.6)
      const vel = velRef.current;
      const lam = moving ? 12 : 7.5;
      // Turn-skid: desired dir opposes current velocity while moving fast.
      skidCooldownRef.current = Math.max(0, skidCooldownRef.current - delta);
      if (moving && skidCooldownRef.current === 0) {
        const sp = Math.hypot(vel.x, vel.y);
        if (sp > PLAYER_SPEED * 0.55 && dx * vel.x + dz * vel.y < -0.4 * sp) {
          skidCooldownRef.current = 0.6;
          const id = puffIdRef.current++;
          setPuffs((prev) => [...prev, { id, position: [pos.x, pos.y + 0.12, pos.z], scale: 1.15 }]);
          sfx.play("footstep");
        }
      }
      vel.x = THREE.MathUtils.damp(vel.x, moving ? dx * PLAYER_SPEED * speedMult : 0, lam, delta);
      vel.y = THREE.MathUtils.damp(vel.y, moving ? dz * PLAYER_SPEED * speedMult : 0, lam, delta);
      if (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02) {
        pos.x += vel.x * delta;
        pos.z += vel.y * delta;
        const [cpx, cpz] = clampToCoast(pos.x, pos.z, BOUNDARY);
        pos.x = cpx;
        pos.z = cpz;
      }
      if (moving) {
        const targetAngle = Math.atan2(dx, dz);
        facingRef.current = THREE.MathUtils.lerp(
          facingRef.current,
          targetAngle,
          ROTATION_LERP * delta
        );
      }
      // Lean into screen-space lateral motion (~5° max), damped.
      const latVel = vel.x * rx + vel.y * rz;
      const targetLean = THREE.MathUtils.clamp(-latVel / PLAYER_SPEED, -1, 1) * 0.085;
      leanRef.current = THREE.MathUtils.damp(leanRef.current, targetLean, 10, delta);
      applySprintFov(camera, Math.hypot(vel.x, vel.y), delta);
    }

    // Ground follow — sample terrain every frame (even when idle so the
    // avatar settles if terrain ever changes) and damp toward it. Damping
    // keeps slope transitions smooth instead of snapping per step.
    // Per-frame: lookup-grid bilinear sample (~50x cheaper than FBM).
    const targetY = sampleTerrainHeightFast(pos.x, pos.z) + AVATAR_FOOT_OFFSET;
    pos.y = THREE.MathUtils.damp(pos.y, targetY, 1 / Y_DAMP_TIME, delta);

    // Determine direction for sprite sheet
    const angle = facingRef.current;
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // facing = atan2(dx, dz): 0 = +z (away from the default camera → back
    // view), π = toward camera (front). Verified against the Ninja sheet
    // 2026-07-04 — the old mapping had up/down swapped for this layout.
    let anim = moving ? WALK_UP : DIR_UP;
    if (normalizedAngle > Math.PI * 0.25 && normalizedAngle <= Math.PI * 0.75) {
      anim = moving ? WALK_LEFT : DIR_LEFT;
    } else if (normalizedAngle > Math.PI * 0.75 && normalizedAngle <= Math.PI * 1.25) {
      anim = moving ? WALK_DOWN : DIR_DOWN;
    } else if (normalizedAngle > Math.PI * 1.25 && normalizedAngle <= Math.PI * 1.75) {
      anim = moving ? WALK_RIGHT : DIR_RIGHT;
    }

    // G4 idle look-around: 12s still → glance left (1s), right (1s), front
    // (1s), then rest for another cycle.
    if (moving) {
      idleTimeRef.current = 0;
    } else {
      idleTimeRef.current += delta;
      const it = idleTimeRef.current;
      if (it > 12) {
        const seq = (it - 12) % 9;
        if (seq < 1) anim = DIR_LEFT;
        else if (seq < 2) anim = DIR_RIGHT;
        else if (seq < 3) anim = DIR_DOWN;
      }
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

    // Update UV offset — direction picks the column, frame picks the row.
    const col = anim.col;
    const row = currentFrame.current % anim.frames;
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

    // F1.2 jump arc — simple parabola over 0.5s, peak ~0.6 units.
    let jumpY = 0;
    if (jumpRef.current.active) {
      jumpRef.current.t += delta;
      const j = jumpRef.current.t / 0.5; // 0 → 1 over 0.5s
      if (j >= 1) {
        jumpRef.current.active = false;
        jumpRef.current.t = 0;
        squashRef.current = 0.18; // G1: landing squash window
        sfx.play("footstep"); // land thud
        // P29: landing puff — bigger ring at the player's current spot.
        const id = puffIdRef.current++;
        setPuffs((prev) => [
          ...prev,
          { id, position: [pos.x, pos.y + 0.02, pos.z], scale: 1.6 },
        ]);
      } else {
        // 4 * j * (1-j) peaks at j=0.5 with value 1
        jumpY = 4 * j * (1 - j) * 0.6;
      }
    }

    if (meshRef.current) {
      meshRef.current.position.y = SPRITE_BASE_Y + bobY + jumpY;
      // G1 squash & stretch: stretch on the way up, squash for ~0.18s on
      // landing, lean tilt from lateral motion. Billboard makes rotation.z
      // a clean screen-space tilt.
      let sx = 1, sy = 1;
      if (jumpRef.current.active) {
        sx = 0.96; sy = 1.06;
      } else if (squashRef.current > 0) {
        squashRef.current = Math.max(0, squashRef.current - delta);
        const q = squashRef.current / 0.18;
        sx = 1 + 0.1 * q;
        sy = 1 - 0.12 * q;
      }
      meshRef.current.scale.set(sx, sy, 1);
      meshRef.current.rotation.z = leanRef.current;
    }

    // Footstep SFX — fire ~every 0.4s walking, ~0.25s when sprinting (F1.6).
    // No-op if audio is muted or assets aren't shipped (manager silently
    // drops the call).
    if (moving) {
      footstepTimer.current += delta;
      const footstepInterval = keys["shift"] ? 0.25 : 0.4;
      if (footstepTimer.current >= footstepInterval) {
        footstepTimer.current = 0;
        sfx.play("footstep");
        // P28: spawn a dust puff at the player's feet. Trailing slightly
        // behind the movement direction so it reads as kicked-up dust.
        const trailX = pos.x - (dx || 0) * 0.2;
        const trailZ = pos.z - (dz || 0) * 0.2;
        const id = puffIdRef.current++;
        setPuffs((prev) => [...prev, { id, position: [trailX, pos.y + 0.02, trailZ], scale: keys["shift"] ? 1.3 : 1 }]);
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
      {/* P28: footstep dust puffs (small) + P29 landing puff (scale > 1) */}
      {puffs.map((p) => (
        <FootstepPuff
          key={p.id}
          position={p.position}
          baseScale={p.scale ?? 1}
          onDone={() => setPuffs((prev) => prev.filter((q) => q.id !== p.id))}
        />
      ))}
      <group ref={groupRef} position={spawnPosition}>
      {/* (Art pass 2026-07-07: the player keeps its ORIGINAL static_shadow
          decal below — adding a second blob here doubled the shadow.) */}
      {/* Character sprite on billboard. P31: bumped 1.0×1.4 → 1.4×2.0
          (~40% larger) so the player reads clearly at default camera
          distance. Sprite-base-y also pushed up to keep the avatar
          feet-on-ground. */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* P-light v2 character pop: dark silhouette halo behind the
            sprite (same animated texture, black-multiplied, 7% larger) —
            the classic outline trick that separates characters from the
            world. One extra draw. */}
        <mesh position={[0, 1.1, -0.012]} scale={[1.07, 1.07, 1]}>
          <planeGeometry args={[1.45, 1.45]} />
          <meshBasicMaterial
            map={spriteTexture}
            color="#2A2118"
            transparent
            opacity={0.55}
            alphaTest={0.1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={meshRef} position={[0, 1.1, 0]}>
          <planeGeometry args={[1.45, 1.45]} />
          {/* Playtest fix 2026-07-13: depthWrite ON — alphaTest already
              cuts the sprite out, and without depth the ground path ribbon
              (transparent, sorted by mesh center) composited over the
              player's body. Cutout + depth is the standard sprite recipe. */}
          <meshBasicMaterial
            map={spriteTexture}
            transparent
            alphaTest={0.1}
            side={THREE.DoubleSide}
            depthWrite
          />
        </mesh>
      </Billboard>

      {/* Ground shadow — scaled to the pt2 smaller sprite. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Sprint E3: active emote bubble above the avatar's head. Parent clears
          activeEmote after 3.5s so this just unmounts automatically. */}
      {sitNote && (
        <Html position={[0, 2.1, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ fontSize: 20, animation: "tsi-sit-note 1.7s ease-out forwards" }}>♪</div>
          <style>{`
            @keyframes tsi-sit-note {
              0% { opacity: 0; transform: translateY(6px) rotate(-8deg); }
              20% { opacity: 0.9; transform: translateY(0) rotate(4deg); }
              100% { opacity: 0; transform: translateY(-14px) rotate(-4deg); }
            }
          `}</style>
        </Html>
      )}
      {activeEmote && (
        <Html zIndexRange={[40, 0]}
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
      <Html zIndexRange={[40, 0]}
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

// P28: a single dust puff at the player's feet. Expands and fades out
// over 0.6s, then calls onDone so the parent removes it from state.
function FootstepPuff({ position, onDone, baseScale = 1 }: { position: [number, number, number]; onDone: () => void; baseScale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const tRef = useRef(0);
  useFrame((_, delta) => {
    tRef.current += delta;
    const t = tRef.current / 0.6;
    if (t >= 1) {
      onDone();
      return;
    }
    if (ref.current) {
      const s = (0.35 + t * 0.4) * baseScale;
      ref.current.scale.set(s, s, s);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.55 * (1 - t);
    }
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1, 12]} />
      <meshBasicMaterial
        ref={matRef}
        color="#D8C8A8"
        transparent
        opacity={0.55}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
