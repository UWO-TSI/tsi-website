"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { easing } from "maath";
import * as THREE from "three";
import type { Feedback } from "./vault";
import { drawTicket, TICKET_H, TICKET_W } from "./ticketTexture";

export type VaultMode = "gate" | "test" | "judging" | "reveal";

type Props = {
  mode: VaultMode;
  feedback: Feedback | null;
  guessKey: number;
  name: string;
  project: string;
  memberNo: string;
  date: string;
  onOpened: () => void;
  captureRef: MutableRefObject<(() => string) | null>;
};

const VAULT_SIZE = 4.6;
const BOLTS = 10;
const LAMP_X = [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6];

const GREEN = new THREE.Color("#22c55e");
const AMBER = new THREE.Color("#ffd166");
const RED = new THREE.Color("#ef4444");
const OFF = new THREE.Color("#1a1d22");

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const outBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const outCubic = (t: number) => 1 - (1 - t) ** 3;

// Shared timeline state so every part of the scene reads the same clock.
type Shared = {
  openAt: number;
  judgeAt: number;
  kick: number;
  wheelTarget: number;
};

function useMaterials() {
  return useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: "#4a525e", metalness: 1, roughness: 0.3 }),
      plate: new THREE.MeshStandardMaterial({ color: "#69727f", metalness: 1, roughness: 0.26 }),
      dark: new THREE.MeshStandardMaterial({ color: "#16191e", metalness: 0.9, roughness: 0.45 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#d9dee6", metalness: 1, roughness: 0.12 }),
      brass: new THREE.MeshStandardMaterial({ color: "#c9a14a", metalness: 1, roughness: 0.26 }),
      wall: new THREE.MeshStandardMaterial({ color: "#101216", metalness: 0.2, roughness: 0.9 }),
      inside: new THREE.MeshStandardMaterial({
        color: "#3a2a10",
        emissive: new THREE.Color("#ffb84d"),
        emissiveIntensity: 0,
        metalness: 0.6,
        roughness: 0.5,
        side: THREE.BackSide,
      }),
    }),
    []
  );
}

function Vault({
  mode,
  feedback,
  guessKey,
  shared,
}: Pick<Props, "mode" | "feedback" | "guessKey"> & { shared: MutableRefObject<Shared> }) {
  const m = useMaterials();
  const root = useRef<THREE.Group>(null);
  const hinge = useRef<THREE.Group>(null);
  const face = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const bolts = useRef<THREE.Mesh[]>([]);
  const glow = useRef<THREE.PointLight>(null);
  const lamps = useMemo(
    () =>
      LAMP_X.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: "#0c0d10",
            emissive: OFF.clone(),
            emissiveIntensity: 1,
            toneMapped: false,
          })
      ),
    []
  );
  const lampMeshes = useRef<THREE.Mesh[]>([]);
  const pop = useRef(0);

  useEffect(() => {
    if (!guessKey) return;
    pop.current = 1;
  }, [guessKey]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const s = shared.current;
    const vp = state.viewport.getCurrentViewport(state.camera, [0, 0, 0]);
    const landscape = vp.width > vp.height;

    // Layout: vault sits top (portrait) or left (landscape) while testing, centered on reveal.
    let x = 0;
    let y = 0;
    let sc = 1;
    if (mode === "reveal") {
      sc = Math.min(1, (vp.width * 0.92) / VAULT_SIZE, (vp.height * 0.72) / VAULT_SIZE);
    } else if (landscape) {
      sc = Math.min(1.1, (vp.height * 0.78) / VAULT_SIZE, (vp.width * 0.46) / VAULT_SIZE);
      x = -vp.width * 0.24;
    } else {
      sc = Math.min(1, (vp.width * 0.82) / VAULT_SIZE, (vp.height * 0.38) / VAULT_SIZE);
      y = vp.height / 2 - vp.height * 0.23;
    }
    if (root.current) {
      easing.damp3(root.current.position, [x, y, 0], 0.5, dt);
      easing.damp3(root.current.scale, [sc, sc, sc], 0.5, dt);
    }

    // Guess feedback: thunk + wheel spin.
    // eslint-disable-next-line react-hooks/immutability -- per-frame three.js mutation
    s.kick = Math.max(0, s.kick - dt * 3.2);
    pop.current = Math.max(0, pop.current - dt * 2.4);
    if (face.current) {
      const k = s.kick;
      face.current.position.z = -0.08 * k * Math.cos(k * 18);
      face.current.rotation.z = 0.015 * k * Math.sin(k * 30);
    }

    const opening = mode === "reveal" ? t - s.openAt : -1;

    if (wheel.current) {
      if (opening >= 0) {
        const spin = inOut(seg(opening, 0.9, 1.9));
        wheel.current.rotation.z = s.wheelTarget + spin * Math.PI * 3;
      } else {
        easing.damp(wheel.current.rotation, "z", s.wheelTarget, 0.35, dt);
      }
    }

    // Bolts retract, then the door swings out on its hinge.
    const retract = opening >= 0 ? outCubic(seg(opening, 0.9, 1.5)) : 0;
    bolts.current.forEach((b, i) => {
      if (!b) return;
      const a = (i / BOLTS) * Math.PI * 2;
      const r = 1.86 - retract * 0.42;
      b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    });
    if (hinge.current) {
      const swing = opening >= 0 ? outBack(seg(opening, 1.6, 3.0)) : 0;
      hinge.current.rotation.y = -1.9 * swing;
    }
    const inner = opening >= 0 ? outCubic(seg(opening, 1.5, 2.6)) : 0;
    // eslint-disable-next-line react-hooks/immutability -- per-frame three.js mutation
    m.inside.emissiveIntensity = inner * 0.9;
    if (glow.current) glow.current.intensity = inner * 60;

    // Lamps.
    lamps.forEach((mat, i) => {
      let target = OFF;
      let intensity = 1;
      if (opening >= 0) {
        const on = opening > 0.15 + i * 0.11;
        target = on ? GREEN : OFF;
        intensity = on ? 3.5 : 1;
      } else if (mode === "judging") {
        const blink = Math.sin((t - s.judgeAt) * 12) > 0;
        target = blink ? RED : OFF;
        intensity = blink ? 4 : 1;
      } else if (feedback) {
        if (i < feedback.exact) target = GREEN;
        else if (i < feedback.exact + feedback.misplaced) target = AMBER;
        else if (feedback.exact === LAMP_X.length - 1) {
          target = RED;
          intensity = 2 + Math.sin(t * 9) * 1.4;
        }
        if (target !== OFF) intensity = Math.max(intensity, 2.6 + pop.current * 3);
      }
      mat.emissive.lerp(target, 1 - Math.exp(-dt * 14));
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, intensity, 1 - Math.exp(-dt * 14));
      const lm = lampMeshes.current[i];
      if (lm) {
        const p = opening >= 0 ? (opening > 0.15 + i * 0.11 ? Math.max(0, 1 - (opening - 0.15 - i * 0.11) * 4) : 0) : pop.current;
        lm.scale.setScalar(1 + p * 0.45);
      }
    });
  });

  const rivets = useMemo(
    () => Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2),
    []
  );

  return (
    <group ref={root}>
      {/* wall with an opening */}
      <mesh position={[0, 0, -0.32]} material={m.wall}>
        <ringGeometry args={[1.98, 40, 96]} />
      </mesh>
      {/* frame */}
      <mesh position={[0, 0, -0.12]} material={m.dark}>
        <torusGeometry args={[2.04, 0.2, 32, 128]} />
      </mesh>
      <mesh position={[0, 0, 0.02]} material={m.brass}>
        <torusGeometry args={[2.24, 0.025, 16, 128]} />
      </mesh>
      {/* interior */}
      <mesh position={[0, 0, -2]} rotation={[Math.PI / 2, 0, 0]} material={m.inside}>
        <cylinderGeometry args={[1.98, 1.98, 3.4, 64, 1, true]} />
      </mesh>
      <mesh position={[0, 0, -3.6]}>
        <circleGeometry args={[2, 64]} />
        <meshBasicMaterial color="#ffcf7a" toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[0, 0, -1.2]} color="#ffc56b" intensity={0} distance={9} decay={1.6} />
      <Sparkles count={70} scale={[3.4, 3.4, 3]} position={[0, 0, -1.8]} size={3} speed={0.35} color="#ffd8a0" />

      {/* door, pivoting on the left hinge */}
      <group ref={hinge} position={[-1.8, 0, 0.05]}>
        <group position={[1.8, 0, 0]}>
          <group ref={face}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={m.steel}>
              <cylinderGeometry args={[1.8, 1.8, 0.42, 128]} />
            </mesh>
            <mesh position={[0, 0, 0.215]} rotation={[Math.PI / 2, 0, 0]} material={m.plate}>
              <cylinderGeometry args={[1.58, 1.58, 0.04, 128]} />
            </mesh>
            <mesh position={[0, 0, 0.23]} material={m.brass}>
              <torusGeometry args={[1.62, 0.035, 16, 128]} />
            </mesh>
            <mesh position={[0, 0, 0.24]} material={m.dark}>
              <torusGeometry args={[1.0, 0.03, 16, 96]} />
            </mesh>
            {rivets.map((a, i) => (
              <mesh key={i} position={[Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.21]} material={m.chrome}>
                <sphereGeometry args={[0.035, 12, 12]} />
              </mesh>
            ))}
            {Array.from({ length: BOLTS }, (_, i) => {
              const a = (i / BOLTS) * Math.PI * 2;
              return (
                <mesh
                  key={i}
                  ref={(el) => {
                    if (el) bolts.current[i] = el;
                  }}
                  rotation={[0, 0, a + Math.PI / 2]}
                  material={m.chrome}
                >
                  <cylinderGeometry args={[0.08, 0.08, 0.5, 20]} />
                </mesh>
              );
            })}

            {/* lamps */}
            {LAMP_X.map((lx, i) => (
              <group key={i} position={[lx, 1.12, 0.24]}>
                <mesh material={m.brass}>
                  <torusGeometry args={[0.1, 0.02, 12, 32]} />
                </mesh>
                <mesh
                  ref={(el) => {
                    if (el) lampMeshes.current[i] = el;
                  }}
                  material={lamps[i]}
                >
                  <sphereGeometry args={[0.075, 24, 24]} />
                </mesh>
              </group>
            ))}

            {/* wheel */}
            <group ref={wheel} position={[0, -0.05, 0.3]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={m.chrome}>
                <cylinderGeometry args={[0.2, 0.24, 0.16, 48]} />
              </mesh>
              <mesh material={m.chrome}>
                <torusGeometry args={[0.66, 0.055, 24, 96]} />
              </mesh>
              {[0, 1, 2].map((k) => (
                <mesh key={k} rotation={[0, 0, (k * Math.PI) / 3]} material={m.chrome}>
                  <boxGeometry args={[1.5, 0.07, 0.07]} />
                </mesh>
              ))}
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const a = (k * Math.PI) / 3;
                return (
                  <mesh key={k} position={[Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0]} material={m.brass}>
                    <sphereGeometry args={[0.085, 20, 20]} />
                  </mesh>
                );
              })}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function Ticket({
  mode,
  name,
  project,
  memberNo,
  date,
  shared,
  onOpened,
}: Pick<Props, "mode" | "name" | "project" | "memberNo" | "date" | "onOpened"> & {
  shared: MutableRefObject<Shared>;
}) {
  const group = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const holo = useRef<THREE.MeshPhysicalMaterial>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!name) return;
    let live = true;
    let made: THREE.Texture | null = null;
    drawTicket(name, project, memberNo, date).then((t) => {
      if (!live) return t.dispose();
      made = t;
      setTex(t);
    });
    return () => {
      live = false;
      made?.dispose();
    };
  }, [name, project, memberNo, date]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (mode !== "reveal") {
      g.visible = false;
      return;
    }
    const t = state.clock.elapsedTime - shared.current.openAt;
    g.visible = t > 1.7;
    const out = outBack(seg(t, 2.1, 3.4));
    const vp = state.viewport.getCurrentViewport(state.camera, [0, 0, 1.7]);
    const fit = Math.min(1, (vp.width * 0.86) / TICKET_W, (vp.height * 0.4) / TICKET_H);

    g.position.set(0, Math.sin(state.clock.elapsedTime * 1.2) * 0.04 * out, THREE.MathUtils.lerp(-1.0, 1.7, out));
    g.scale.setScalar(THREE.MathUtils.lerp(fit * 0.55, fit, out));
    g.rotation.y = (1 - out) * Math.PI * 2;
    g.rotation.z = (1 - out) * -0.25;

    if (tilt.current) {
      easing.damp(tilt.current.rotation, "y", state.pointer.x * 0.35, 0.18, dt);
      easing.damp(tilt.current.rotation, "x", -state.pointer.y * 0.25, 0.18, dt);
    }
    if (holo.current) {
      holo.current.iridescenceIOR = 1.25 + Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
    }
    if (!fired.current && t > 2.6) {
      fired.current = true;
      onOpened();
    }
  });

  return (
    <group ref={group} visible={false}>
      <group ref={tilt}>
        <RoundedBox args={[TICKET_W, TICKET_H, 0.05]} radius={0.06} smoothness={6}>
          <meshStandardMaterial color="#0d1b2a" metalness={0.9} roughness={0.3} />
        </RoundedBox>
        {tex && (
          <mesh position={[0, 0, 0.027]}>
            <planeGeometry args={[TICKET_W - 0.04, TICKET_H - 0.04]} />
            <meshPhysicalMaterial
              ref={holo}
              map={tex}
              emissiveMap={tex}
              emissive="#ffffff"
              emissiveIntensity={0.55}
              metalness={0.35}
              roughness={0.28}
              clearcoat={1}
              clearcoatRoughness={0.1}
              iridescence={1}
              iridescenceIOR={1.3}
              iridescenceThicknessRange={[120, 680]}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Rig({ mode, shared }: { mode: VaultMode; shared: MutableRefObject<Shared> }) {
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const opening = mode === "reveal" ? t - shared.current.openAt : -1;
    const dolly = opening >= 0 ? inOut(seg(opening, 1.4, 3.4)) : 0;
    const shake =
      mode === "judging" ? 0.025 : shared.current.kick * 0.04;
    const px = state.pointer.x * 0.35 * (1 - dolly) + (Math.random() - 0.5) * shake;
    const py = state.pointer.y * 0.2 * (1 - dolly) + (Math.random() - 0.5) * shake;
    easing.damp3(state.camera.position, [px, py, THREE.MathUtils.lerp(8, 6.4, dolly)], 0.25, dt);
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function Capture({ captureRef }: { captureRef: Props["captureRef"] }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    captureRef.current = () => gl.domElement.toDataURL("image/png");
    return () => {
      captureRef.current = null;
    };
  }, [gl, captureRef]);
  return null;
}

export default function VaultScene(props: Props) {
  const { mode, feedback, guessKey } = props;
  const shared = useRef<Shared>({ openAt: 0, judgeAt: 0, kick: 0, wheelTarget: 0 });
  const clockRef = useRef<THREE.Clock | null>(null);

  useEffect(() => {
    if (!guessKey) return;
    shared.current.kick = 1;
    shared.current.wheelTarget += Math.PI * (0.7 + Math.random() * 0.8) * (guessKey % 2 ? 1 : -1);
  }, [guessKey]);

  useEffect(() => {
    const now = clockRef.current?.elapsedTime ?? 0;
    if (mode === "reveal") shared.current.openAt = now;
    if (mode === "judging") shared.current.judgeAt = now;
  }, [mode]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 8], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      eventSource={document.body}
      eventPrefix="client"
      onCreated={(s) => {
        clockRef.current = s.clock;
        s.gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <color attach="background" args={["#0b0c0f"]} />
      <fog attach="fog" args={["#0b0c0f", 9, 22]} />
      <ambientLight intensity={0.3} />
      <spotLight position={[-4, 6, 6]} angle={0.5} penumbra={0.8} intensity={120} color="#dfe8ff" />
      <pointLight position={[5, -2, 4]} intensity={18} color="#22d3ee" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.2} position={[0, 4, 5]} scale={[10, 1.5, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[0, 0, 8]} scale={[12, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#22d3ee" position={[6, 0, 3]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffd166" position={[-6, -1, 3]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="circle" intensity={1.5} position={[0, -5, 2]} scale={4} />
      </Environment>

      <Rig mode={mode} shared={shared} />
      <Vault mode={mode} feedback={feedback} guessKey={guessKey} shared={shared} />
      <Ticket
        mode={mode}
        name={props.name}
        project={props.project}
        memberNo={props.memberNo}
        date={props.date}
        shared={shared}
        onOpened={props.onOpened}
      />
      <Capture captureRef={props.captureRef} />

      <EffectComposer>
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={1.1} />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
