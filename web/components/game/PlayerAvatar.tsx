"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { sampleTerrainHeightFast } from "./terrain";
import { clampToCoast, coastDist } from "@/lib/game/coast";
import { getTodayWeather } from "@/lib/game/weather";
import { useSFX } from "@/lib/game/useAudio";
import { getCameraForwardXZ } from "@/lib/game/cameraBasis";
import { advanceMotion, easeFacing, relativeFacingAngle } from "@/lib/game/locomotion";
import { bindGameKeys } from "@/lib/game/keyboardInput";
import { Surface } from "@/lib/game/grid";
import { calculateCurvedHtmlPosition } from "@/lib/game/worldProjection";
import { pickCurvedGround } from "@/lib/game/groundPick";
import { juiceFovOffset } from "@/lib/game/cameraJuice";
import { getLabFov } from "@/lib/game/devLab";
import MoveTargetIndicator from "./MoveTargetIndicator";
import { getBlobTexture } from "./BlobShadows";
import type { EmoteType } from "@/lib/content/types";
import ApplicantCharacter, { type ApplicantMotion } from "@/components/recruit/ApplicantCharacter";

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
 * Shared billboard avatar using the Ninja Adventure 16px walk sheet.
 * Four direction columns and four animation rows; movement, sprite facing,
 * ground queries and feedback stay synchronized in the frame loop.
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
  avatarMode?: "sprite" | "applicant";
  spawnPosition: [number, number, number];
  onMove: (position: THREE.Vector3) => void;
  playerName?: string;
  showNameplate?: boolean;
  playerLevel?: number;
  activeEmote?: EmoteType | null;
  frozen?: boolean;
  desktopClickToMove?: boolean;
  groundHeight?: (x: number, z: number) => number;
  groundSurface?: (x: number, z: number) => number;
  constrainMove?: (fromX: number, fromZ: number, toX: number, toZ: number) => [number, number];
}

export default function PlayerAvatar({ avatarMode = "sprite", spawnPosition, onMove, playerName = "Player", showNameplate = true, playerLevel = 1, activeEmote = null, frozen = false, desktopClickToMove = false, groundHeight = sampleTerrainHeightFast, groundSurface, constrainMove }: PlayerAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const applicantMotion = useRef<ApplicantMotion>({ speed: 0, yaw: 0, lift: 0 });
  const spriteRef = useRef<THREE.Group>(null);
  // Initialize y on the terrain at spawn so the avatar doesn't visibly
  // drop in from y=0 if the spawn point sits on a slope.
  const positionRef = useRef(new THREE.Vector3(
    spawnPosition[0],
    groundHeight(spawnPosition[0], spawnPosition[2]) + AVATAR_FOOT_OFFSET,
    spawnPosition[2],
  ));
  useEffect(() => { onMove(positionRef.current.clone()); }, [onMove]);
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
  const { play: playSFX } = useSFX();
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
  const [puffs, setPuffs] = useState<Array<{ id: number; position: [number, number, number]; scale?: number; wet?: boolean }>>([]);
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
  // Loop iter 13 (2026-07-24): sprint wind lines — 4 faint streak rods
  // around the player at full sprint, aligned to heading, instant fade on
  // slowdown. All refs; no per-frame React.
  const windGroupRef = useRef<THREE.Group>(null);
  const windMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const squashRef = useRef(0);
  // G4 (item 7): after ~12s of standing still the sprite looks around —
  // left, right, then back to front — so idling reads alive (ACNH beat).
  const idleTimeRef = useRef(0);

  // Configure each avatar’s own UV state; begin image loading after commit.
  const spriteTexture = useMemo(() => {
    const tex = new THREE.Texture();
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
    const tex = new THREE.Texture();
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }, []);

  useEffect(() => {
    let mounted = true;
    const loader = new THREE.ImageLoader();
    const load = (url: string, texture: THREE.Texture) => {
      loader.load(url, (image) => {
        if (!mounted) return;
        texture.image = image;
        texture.needsUpdate = true;
      });
    };
    load("/assets/characters/player_walk.png", spriteTexture);
    load("/assets/characters/static_shadow.png", shadowTexture);
    return () => {
      mounted = false;
      spriteTexture.dispose();
      shadowTexture.dispose();
    };
  }, [spriteTexture, shadowTexture]);

  // Keyboard input. Sprint F1.1: track Shift for sprint multiplier and guard
  // against typing in inputs/textareas/contentEditable so WASD doesn't fire
  // while the user is filling out a form overlay.
  useEffect(() => {
    if (frozen) return;
    return bindGameKeys({ keys, accepted: ["w", "a", "s", "d", "shift", " "],
      onReset: () => { targetRef.current = null; velRef.current.set(0, 0); },
      onPress: (e) => {
        if (["w", "a", "s", "d"].includes(e.key.toLowerCase())) sitRef.current = null;
        // F1.2: Space triggers cosmetic jump. Ignore key-repeat so holding
        // Space doesn't loop the arc — only re-fires after the previous
        // jump finishes.
        if (e.key === " " || e.code === "Space") {
          if (!e.repeat && !jumpRef.current.active) {
            jumpRef.current.active = true;
            jumpRef.current.t = 0;
            // Loop iter 14 (2026-07-24): takeoff beat — landing had squash +
            // puff + thud, liftoff had nothing. Small kick-off puff + a light
            // hop note completes the arc.
            const jp = positionRef.current;
            const id = puffIdRef.current++;
            setPuffs((prev) => [...prev, { id, position: [jp.x, jp.y + 0.02, jp.z], scale: 0.85 }]);
            playSFX("blip2");
          }
          e.preventDefault();
        }
      },
    });
  }, [playSFX, frozen]);

  // Click-to-move
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (frozen || e.defaultPrevented) return;
      // Refinement 2026-07-22 (David): click-to-move is touch-only now.
      // On fine-pointer devices misclicks kept sending the player walking;
      // WASD is the desktop verb. Coarse pointers (phones/tablets in full
      // 3D) keep tap-to-walk.
      if (!desktopClickToMove && window.matchMedia("(pointer: fine)").matches) return;
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);
      // 2026-07-08 sync fix: pick against the VISUALLY CURVED heightfield
      // (terrain height + world-bend), not a flat y=0 plane — clicks were
      // landing short of the point under the cursor.
      const intersection = pickCurvedGround(raycaster.current.ray, camera, groundHeight);

      if (intersection) {
        const pos = positionRef.current;
        const [cix, ciz] = constrainMove
          ? constrainMove(pos.x, pos.z, intersection.x, intersection.z)
          : clampToCoast(intersection.x, intersection.z, BOUNDARY);
        intersection.x = cix;
        intersection.z = ciz;
        intersection.y = 0;
        targetRef.current = intersection;
        playSFX("click");
        // Sprint A8: spawn expanding ring at click point. Re-clicks spawn new
        // rings (key by counter so React mounts a fresh component).
        const id = indicatorIdRef.current++;
        setIndicators((prev) => [
          ...prev,
          { id, position: [intersection.x, groundHeight(intersection.x, intersection.z), intersection.z] },
        ]);
      }
    },
    [camera, gl, playSFX, constrainMove, groundHeight, frozen, desktopClickToMove]
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
        targetRef.current = null;
        jumpRef.current = { active: false, t: 0 };
        squashRef.current = 0;
        // settle: soft dust puff at the seat + ♪ for a moment
        const id = puffIdRef.current++;
        setPuffs((prev) => [...prev, { id, position: [x, groundHeight(x, z) + 0.15, z], scale: 1.3 }]);
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
    return () => {
      window.removeEventListener("tsi:sit", onSit);
      if (sitNoteTimerRef.current) window.clearTimeout(sitNoteTimerRef.current);
    };
  }, [groundHeight]);

  // Movement + sprite animation loop
  useFrame((_, elapsed) => {
    if (!groupRef.current) return;
    const delta = Math.min(elapsed, 0.1);
    if (frozen) { targetRef.current = null; velRef.current.set(0, 0); }

    clockRef.current += delta;
    const pos = positionRef.current;
    const prevX = pos.x;
    const prevZ = pos.z;
    let moving = false;
    let dx = 0;
    let dz = 0;

    // G3: any movement input stands up. Checked before the sit branch so a
    // held key breaks the pose immediately.
    if (!frozen && sitRef.current && (keys["w"] || keys["a"] || keys["s"] || keys["d"] || targetRef.current)) {
      sitRef.current = null;
    }

    // G3: seated — snap to the bench seat, freeze, hold down-idle pose.
    if (sitRef.current) {
      const seat = sitRef.current;
      const seatY = groundHeight(seat.x, seat.z) + AVATAR_FOOT_OFFSET;
      const changed = pos.x !== seat.x || pos.y !== seatY || pos.z !== seat.z;
      pos.set(seat.x, seatY, seat.z);
      groupRef.current.position.copy(pos);
      facingRef.current = Math.PI; // face the camera (down column, front cell)
      currentFrame.current = 0;
      spriteTexture.offset.set(DIR_DOWN.col / SHEET_COLS, 1 - 1 / SHEET_ROWS);
      if (spriteRef.current) {
        // Shorten the standing sprite and bring it just in front of the seat back.
        spriteRef.current.position.set(0, SPRITE_BASE_Y, 0.2);
        spriteRef.current.scale.set(1, 0.82, 1);
        spriteRef.current.rotation.z = 0;
      }
      velRef.current.set(0, 0);
      if (isMoving) setIsMoving(false);
      if (changed) onMove(pos.clone());
      return;
    }

    // Sprint F1.1: camera-relative WASD. Forward = camera direction projected
    // onto XZ plane; right = forward rotated 90° clockwise. Arrow keys are
    // reserved for camera rotation (handled in GameWorld).
    const { fx, fz } = getCameraForwardXZ(camera);
    const rx = -fz;
    const rz = fx;
    const wDown = !frozen && !!keys["w"];
    const sDown = !frozen && !!keys["s"];
    const aDown = !frozen && !!keys["a"];
    const dDown = !frozen && !!keys["d"];
    const sprint = !frozen && !!keys["shift"];
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
      if (toTarget.length() > 0.1) {
        toTarget.normalize();
        dx = toTarget.x;
        dz = toTarget.z;
        moving = true;
      } else {
        targetRef.current = null;
        velRef.current.set(0, 0);
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
          playSFX("footstep");
        }
      }
      const motion = advanceMotion(
        { x: pos.x, z: pos.z, vx: vel.x, vz: vel.y },
        { x: moving ? dx : 0, z: moving ? dz : 0, speed: PLAYER_SPEED * speedMult, response: lam, goal: targetRef.current ?? undefined },
        delta,
        constrainMove ?? ((_x, _z, nextX, nextZ) => clampToCoast(nextX, nextZ, BOUNDARY)),
      );
      pos.x = motion.x;
      pos.z = motion.z;
      vel.set(motion.vx, motion.vz);
      if (motion.arrived) targetRef.current = null;
      if (moving) {
        const targetAngle = Math.atan2(dx, dz);
        facingRef.current = easeFacing(facingRef.current, targetAngle, ROTATION_LERP, delta);
      }
      // Feedback follows movement that survived collision, including glide-out.
      moving = motion.moving;
      // Lean into screen-space lateral motion (~5° max), damped.
      const latVel = vel.x * rx + vel.y * rz;
      const targetLean = THREE.MathUtils.clamp(-latVel / PLAYER_SPEED, -1, 1) * 0.085;
      leanRef.current = THREE.MathUtils.damp(leanRef.current, targetLean, 10, delta);
      applySprintFov(camera, Math.hypot(vel.x, vel.y), delta);

      // Sprint wind lines: visible only near sprint speed, sliding
      // backward past the player; opacity collapses fast on slowdown.
      const wg = windGroupRef.current;
      if (wg) {
        const spd = Math.hypot(vel.x, vel.y);
        const showWind = spd > PLAYER_SPEED * 1.35;
        let peak = 0;
        for (const m of windMatsRef.current) {
          if (!m) continue;
          m.opacity = THREE.MathUtils.damp(m.opacity, showWind ? 0.2 : 0, showWind ? 8 : 22, delta);
          peak = Math.max(peak, m.opacity);
        }
        wg.visible = peak > 0.015;
        if (wg.visible) {
          wg.position.set(pos.x, pos.y, pos.z);
          wg.rotation.y = Math.atan2(vel.x, vel.y);
          for (let i = 0; i < wg.children.length; i++) {
            wg.children[i].position.z = -0.15 - ((clockRef.current * 5 + i * 0.65) % 1) * 1.1;
          }
        }
      }
    }

    // Ground follow — sample terrain every frame (even when idle so the
    // avatar settles if terrain ever changes) and damp toward it. Damping
    // keeps slope transitions smooth instead of snapping per step.
    // Per-frame: lookup-grid bilinear sample (~50x cheaper than FBM).
    const targetY = groundHeight(pos.x, pos.z) + AVATAR_FOOT_OFFSET;
    pos.y = THREE.MathUtils.damp(pos.y, targetY, 1 / Y_DAMP_TIME, delta);

    // Determine direction for sprite sheet
    const angle = relativeFacingAngle(facingRef.current, fx, fz);
    const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Camera-relative heading: away uses the back of the sprite, toward
    // uses its front. Rotating the view must rotate this mapping too.
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
        playSFX("footstep"); // land thud
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

    if (spriteRef.current) {
      spriteRef.current.position.set(0, SPRITE_BASE_Y + bobY + jumpY, 0);
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
      spriteRef.current.scale.set(sx, sy, 1);
      spriteRef.current.rotation.z = leanRef.current;
    }
    applicantMotion.current.speed = delta > 0 ? Math.hypot(pos.x - prevX, pos.z - prevZ) / delta : 0;
    applicantMotion.current.yaw = facingRef.current;
    applicantMotion.current.lift = jumpY + 0.018;

    // Footstep SFX — fire ~every 0.4s walking, ~0.25s when sprinting (F1.6).
    // No-op if audio is muted or assets aren't shipped (manager silently
    // drops the call).
    if (moving) {
      footstepTimer.current += delta;
      const footstepInterval = keys["shift"] ? 0.25 : 0.4;
      if (footstepTimer.current >= footstepInterval) {
        footstepTimer.current = 0;
        // Loop iter 26 (2026-07-24): the bridge knocks — steps on the main
        // river crossing play a wooden note instead of the grass scuff.
        const surface = groundSurface?.(pos.x, pos.z);
        const onBridge = surface !== undefined ? surface === Surface.Wood : (Math.abs(pos.x) < 2.2 && pos.z > 0 && pos.z < 6.5) || (Math.abs(pos.x - 39.25) < 1.8 && pos.z > 0.9 && pos.z < 6.6) || (pos.x > 43.2 && pos.x < 45.2 && pos.z > 0.4 && pos.z < 5); // S2+S3: crossings + pier knock
        // Loop wake 31: the brick plaza taps — hard pavement note (matches
        // RoadTiles' PLAZA rect), and dry brick kicks no dirt.
        const onBrick = surface !== undefined ? surface === Surface.Brick || surface === Surface.Stone : pos.x > -5.4 && pos.x < 5.4 && pos.z > -16.6 && pos.z < -9.4;
        playSFX(onBridge ? "blip4" : onBrick ? "blip3" : "footstep");
        // P28: spawn a dust puff at the player's feet. Trailing slightly
        // behind the movement direction so it reads as kicked-up dust.
        const trailX = pos.x - (dx || 0) * 0.2;
        const trailZ = pos.z - (dz || 0) * 0.2;
        const id = puffIdRef.current++;
        // Loop iter 7 (2026-07-24): on the beach band footsteps splash a
        // wet ring instead of kicking dust (coast-space distance past the
        // sand line ≈48.5). Iter 22: rain days make EVERY step a puddle
        // ripple — the weather reaches the ground (incl. puddles on brick).
        const wet = (!groundSurface && coastDist(trailX, trailZ) > 48.5) || getTodayWeather() === "rain";
        if (!onBridge && (!onBrick || wet)) setPuffs((prev) => [...prev, { id, position: [trailX, pos.y + 0.02, trailZ], scale: keys["shift"] ? 1.3 : 1, wet }]);
      }
    } else {
      footstepTimer.current = 0;
    }

    if (moving !== isMoving) setIsMoving(moving);
    // Notify camera/parent when moving, or when y is still settling toward
    // the terrain (keeps camera in sync after stopping on a slope).
    const ySettling = Math.abs(pos.y - targetY) > 0.005;
    if (moving || ySettling) onMove(pos.clone());
  }, -3);

  return (
    <>
      {/* Sprint A8: click-to-move target indicators in world space */}
      {indicators.map((ind) => (
        <MoveTargetIndicator
          key={ind.id}
          position={ind.position}
          groundHeight={groundHeight}
          onComplete={() =>
            setIndicators((prev) => prev.filter((i) => i.id !== ind.id))
          }
        />
      ))}
      {/* Loop iter 13: sprint wind streaks (world-space, heading-aligned) */}
      <group ref={windGroupRef} visible={false}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[i % 2 ? 0.45 : -0.45, 0.55 + (i >> 1) * 0.55, -0.4]}>
            <boxGeometry args={[0.025, 0.025, 0.85]} />
            <meshBasicMaterial
              ref={(m) => { if (m) windMatsRef.current[i] = m; }}
              color="#FFFFFF"
              transparent
              opacity={0}
              depthWrite={false}
              fog={false}
            />
          </mesh>
        ))}
      </group>
      {/* P28: footstep dust puffs (small) + P29 landing puff (scale > 1) */}
      {puffs.map((p) => (
        <FootstepPuff
          key={p.id}
          position={p.position}
          baseScale={p.scale ?? 1}
          wet={p.wet}
          onDone={() => setPuffs((prev) => prev.filter((q) => q.id !== p.id))}
        />
      ))}
      <group ref={groupRef} position={spawnPosition}>
      {/* Each avatar uses one ground decal below, sized for its visual. */}
      {/* The sprite, outline and nameplate share the same animated pose. */}
      {avatarMode === "applicant" ? <ApplicantCharacter motion={applicantMotion} frozen={frozen} /> : <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group ref={spriteRef} position={[0, SPRITE_BASE_Y, 0]}>
        {/* P-light v2 character pop: dark silhouette halo behind the
            sprite (same animated texture, black-multiplied, 7% larger) —
            the classic outline trick that separates characters from the
            world. One extra draw. */}
        <mesh position={[0, 0, -0.012]} scale={[1.07, 1.07, 1]}>
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
        <mesh>
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
      {/* Nameplate */}
      {showNameplate && <Html calculatePosition={calculateCurvedHtmlPosition} zIndexRange={[40, 0]}
        position={[0, 1.12, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div
          className="whitespace-nowrap text-center"
          style={{
            background: "rgba(15, 15, 16, 0.6)",
            padding: "2px 8px",
            borderRadius: "4px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#f1ffff", lineHeight: 1.2 }}>
            {playerName}
          </div>
          <div style={{ fontSize: "9px", color: "#b8c3c3", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.2 }}>
            Lv. {playerLevel}
          </div>
        </div>
      </Html>}
        </group>
      </Billboard>}

      {/* The sprite's tiny atlas shadow does not cover the 3D model's feet. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={avatarMode === "applicant" ? 1 : 0}>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial
          map={avatarMode === "applicant" ? getBlobTexture() : shadowTexture}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* Sprint E3: active emote bubble above the avatar's head. Parent clears
          activeEmote after 3.5s so this just unmounts automatically. */}
      {sitNote && (
        <Html calculatePosition={calculateCurvedHtmlPosition} position={[0, 2.1, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
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
        <Html calculatePosition={calculateCurvedHtmlPosition} zIndexRange={[40, 0]}
          position={[0, 2.6, 0]}
          center
          style={{ pointerEvents: "none" }}
          >
          {/* Loop iter 19 (2026-07-24): burst — six sparks fly radially on
              emote start so a wave reads across the plaza. One-shot per
              emote instance (keyed by id + start). */}
          <div style={{ position: "relative" }}>
            {Array.from({ length: 6 }).map((_, bi) => (
              <span
                key={`${activeEmote.id}-${bi}`}
                aria-hidden
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: bi % 2 ? "#FFD166" : "#FFFDF5",
                  ["--ex" as string]: `${Math.cos((bi / 6) * Math.PI * 2) * 34}px`,
                  ["--ey" as string]: `${Math.sin((bi / 6) * Math.PI * 2) * 26}px`,
                  animation: "playerEmoteSpark 0.55s ease-out forwards",
                  pointerEvents: "none",
                }}
              />
            ))}
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
          </div>
          <style jsx>{`
            .player-emote-bubble {
              animation: playerEmoteBounce 600ms ease-in-out infinite;
            }
            @keyframes playerEmoteSpark {
              0% { opacity: 0.95; transform: translate(-50%, -50%); }
              100% { opacity: 0; transform: translate(calc(-50% + var(--ex)), calc(-50% + var(--ey))) scale(0.5); }
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


      </group>
    </>
  );
}

// P28: a single dust puff at the player's feet. Expands and fades out
// over 0.6s, then calls onDone so the parent removes it from state.
function FootstepPuff({ position, onDone, baseScale = 1, wet = false }: { position: [number, number, number]; onDone: () => void; baseScale?: number; wet?: boolean }) {
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
      // Wet rings spread wider and thinner than dust (iter 7).
      const s = (wet ? 0.3 + t * 0.75 : 0.35 + t * 0.4) * baseScale;
      ref.current.scale.set(s, s, s);
    }
    if (matRef.current) {
      matRef.current.opacity = (wet ? 0.45 : 0.55) * (1 - t);
    }
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      {wet ? <ringGeometry args={[0.72, 1, 16]} /> : <circleGeometry args={[1, 12]} />}
      <meshBasicMaterial
        ref={matRef}
        color={wet ? "#DFF2FC" : "#D8C8A8"}
        transparent
        opacity={0.55}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
