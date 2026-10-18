"use client";

/**
 * The shop's turning stage (David, 2026-10-18: "item 3d large on left rotate"): a canvas drawn at a third of its size
 * and scaled up without smoothing (the game's pixel finish), a soft studio light, and whatever it holds turning slowly.
 * Drag to turn it yourself (left and right, and a little up and down); let go and it carries on, then eases back into
 * its slow turn after a pause. Something in it that can be pressed (the keychain's keycap) arms a tap as the pointer goes
 * down on it (`useStageTap`); the tap fires as the pointer comes up, only if it hardly moved (a click, not a drag).
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";

/** How fine the pixels are: the canvas draws at this share of its size (the world's pixel mode draws at 0.5). */
export const STAGE_PIXEL = 0.33;
/** The slow turn (rad/s), and how long after a drag before it comes back. */
export const AUTO_TURN = 0.55, RESUME_S = 1.6;
/** The fastest it coasts after a drag (rad/s). */
export const COAST_MAX = 2.5;

/** One stage's turn: where it is, how fast it's going, and the gesture under way. */
export interface Turn {
  yaw: number; pitch: number; spin: number; down: boolean; moved: number; lastX: number; lastY: number; idleSince: number;
  /** Rock side to side this far (rad) instead of turning all the way round (a flat thing, the sticker: its back stays away). */
  sway?: number;
}
export const newTurn = (yaw = 0.5, sway?: number): Turn => ({ yaw: sway ? 0 : yaw, pitch: 0.12, spin: sway ? 0 : AUTO_TURN, down: false, moved: 0, lastX: 0, lastY: 0, idleSince: -Infinity, sway });

/** One frame of the turn (dt seconds, now in seconds): a drag holds it; after one it coasts, then eases back to the slow turn. */
export function stepTurn(t: Turn, dt: number, now: number): Turn {
  if (t.down) return t;
  if (t.sway) {
    // after a drag it coasts a moment, then eases back into rocking (from wherever the drag left it, the short way)
    if (now - t.idleSince > RESUME_S * 0.5) {
      t.yaw = Math.atan2(Math.sin(t.yaw), Math.cos(t.yaw));
      t.yaw += (t.sway * Math.sin(now * 0.6) - t.yaw) * (1 - Math.exp(-dt * 1.2));
      t.spin = 0;
    } else { t.spin *= Math.exp(-dt * 3); t.yaw += t.spin * dt; }
    t.pitch += (0.12 - t.pitch) * (1 - Math.exp(-dt * 1.5));
    return t;
  }
  const target = now - t.idleSince > RESUME_S ? AUTO_TURN : 0;
  t.spin += (target - t.spin) * (1 - Math.exp(-dt * (target ? 1.2 : 3)));
  t.yaw += t.spin * dt;
  t.pitch += (0.12 - t.pitch) * (1 - Math.exp(-dt * 1.5));
  return t;
}
/** A drag's move (px): the stage turns with it, and it remembers how fast for the coast after. */
export function dragTurn(t: Turn, dx: number, dy: number, dt: number, now: number): Turn {
  t.moved += Math.abs(dx) + Math.abs(dy);
  t.yaw += dx * 0.012;
  t.pitch = Math.max(-0.6, Math.min(0.8, t.pitch + dy * 0.006));
  // The coast after: the drag's speed, smoothed over a few moves and held to a calm turn (no flick sends it whirling).
  const v = dt > 0 ? Math.max(-COAST_MAX, Math.min(COAST_MAX, (dx * 0.012) / dt)) : 0;
  t.spin += (v - t.spin) * 0.35;
  t.idleSince = now;
  return t;
}

/** Under this many px of movement, a pointer down and up is a click. */
export const TAP_PX = 5;
const StageContext = createContext<{ arm: (fn: () => void) => void } | null>(null);
/** Inside a stage: arm a tap from a pointer-down on a part (it runs on the pointer-up if that was a click). */
export function useStageTap(): (fn: () => void) => void {
  return useContext(StageContext)?.arm ?? (() => {});
}

function Spinner({ turn, children }: { turn: { current: Turn }; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const t = stepTurn(turn.current, Math.min(dt, 0.1), performance.now() / 1000);
    if (group.current) { group.current.rotation.y = t.yaw; group.current.rotation.x = t.pitch; }
  });
  return <group ref={group}>{children}</group>;
}

/** Module scope (three objects written outside React's state): the studio room baked into the scene's environment. */
function lightStudio(gl: THREE.WebGLRenderer, scene: THREE.Scene): () => void {
  const pmrem = new THREE.PMREMGenerator(gl);
  const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();
  return () => { if (scene.environment === target.texture) scene.environment = null; target.dispose(); };
}
/** A soft studio room for every item to reflect (the keychain's silver most of all), made once per stage. */
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => lightStudio(gl, scene), [gl, scene]);
  return null;
}

export default function TurnStage({ children, className, cameraZ = 4.2, label, sway }: {
  children: ReactNode; className?: string; cameraZ?: number; label: string;
  /** Rock this far either way (rad) instead of turning all the way round. */
  sway?: number;
}) {
  const turn = useRef<Turn>(newTurn(0.5, sway));
  const last = useRef(0);
  const armed = useRef<(() => void) | null>(null);
  const [ctx] = useState(() => ({ arm: (fn: () => void) => { armed.current = fn; } }));
  return <StageContext.Provider value={ctx}>
    <div className={className} role="img" aria-label={`${label}: drag to turn it`} style={{ touchAction: "none", cursor: "grab" }}
      onPointerDown={e => {
        const t = turn.current;
        t.down = true; t.moved = 0; t.lastX = e.clientX; t.lastY = e.clientY; t.spin = 0;
        last.current = performance.now();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        const t = turn.current;
        if (!t.down) return;
        const now = performance.now();
        dragTurn(t, e.clientX - t.lastX, e.clientY - t.lastY, (now - last.current) / 1000, now / 1000);
        t.lastX = e.clientX; t.lastY = e.clientY; last.current = now;
      }}
      onPointerUp={e => {
        const t = turn.current, tap = armed.current;
        t.down = false; armed.current = null;
        if (tap && t.moved < TAP_PX) tap(); else t.idleSince = performance.now() / 1000;
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      }}
      onPointerCancel={() => { turn.current.down = false; armed.current = null; }}>
      <Canvas dpr={STAGE_PIXEL} camera={{ position: [0, 0.15, cameraZ], fov: 30 }} gl={{ antialias: false, alpha: true }} style={{ imageRendering: "pixelated" }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        {/* Studio lighting (on the overlay's white sweep): a big soft key from the upper front side, a fill from the
            other, a rim from behind to lift the silver and the acrylic off the white, a softbox room to reflect. */}
        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#ffffff", "#d9dbe0", 0.55]} />
        <directionalLight position={[2.4, 3.0, 3.2]} intensity={2.3} />
        <directionalLight position={[-3.0, 1.0, 2.4]} intensity={0.85} />
        <directionalLight position={[0.4, 2.4, -3.6]} intensity={1.8} />
        <Studio />
        <Spinner turn={turn}>{children}</Spinner>
      </Canvas>
    </div>
  </StageContext.Provider>;
}
