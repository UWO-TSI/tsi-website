 
"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, extend, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";

import styles from "./Lanyard.module.css";
import { PEOPLE } from "@/components/site/marks";

// The card is 1.6 x 2.25 world units (the physics box below); its faces and the strap are drawn on canvases, so the
// lanyard needs no model or image files.
const CARD_W = 1.6;
const CARD_H = 2.25;
const INK = "#0f0f10";
const PAPER = "#f1ffff";
const BLUE = "#1d9bf0";

/** A canvas texture redrawn once the site's fonts have loaded (the faces are set in Söhne). */
function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => { g.clearRect(0, 0, w, h); paint(g); tex.needsUpdate = true; };
  draw();
  document.fonts?.ready.then(draw, () => {});
  return tex;
}

/** The Tethos mark (the six people), drawn at (x, y) to a width. */
function drawMark(g: CanvasRenderingContext2D, x: number, y: number, width: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(width / 1410, width / 1410);
  g.fillStyle = color;
  for (const p of PEOPLE) g.fill(new Path2D(p.d), p.evenodd ? "evenodd" : "nonzero");
  g.restore();
}

/** A faint field of characters over a face, on the site's grid. */
function drawField(g: CanvasRenderingContext2D, w: number, h: number, words: string, alpha: number) {
  g.save();
  g.font = `500 22px "Sohne Mono", ui-monospace, monospace`;
  g.fillStyle = PAPER;
  g.globalAlpha = alpha;
  const cw = 14, ch = 26;
  let k = 0;
  for (let y = ch; y < h; y += ch) for (let x = 0; x < w; x += cw) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    if (s - Math.floor(s) < 0.42) g.fillText(words[k++ % words.length], x, y);
  }
  g.restore();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** The front: the mark, GENESIS 2027, a name line and the GUEST tag, on ink with the site's grain. */
function paintFront(g: CanvasRenderingContext2D) {
  const W = 1024, H = 1440;
  roundRect(g, 0, 0, W, H, 56); g.fillStyle = INK; g.fill();
  g.save(); roundRect(g, 0, 0, W, H, 56); g.clip();
  drawField(g, W, H, "GENESIS · ", 0.07);
  // A glow behind the title.
  const glow = g.createRadialGradient(W * 0.7, H * 0.42, 40, W * 0.7, H * 0.42, 640);
  glow.addColorStop(0, "rgba(29,155,240,0.28)"); glow.addColorStop(1, "rgba(29,155,240,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.restore();
  // The slot the clip goes through.
  roundRect(g, W / 2 - 90, 44, 180, 30, 15); g.fillStyle = "#000"; g.fill();
  drawMark(g, 80, 150, 130, PAPER);
  g.fillStyle = PAPER; g.font = `500 30px "Sohne Mono", ui-monospace, monospace`; g.globalAlpha = 0.6;
  g.fillText("TETHOS", 236, 210); g.fillText("TECH FOR SOCIAL IMPACT", 236, 250); g.globalAlpha = 1;
  g.font = `700 196px "Sohne", sans-serif`; g.fillStyle = PAPER;
  g.save(); g.translate(76, 690); g.scale(1, 1); g.fillText("GENESIS", 0, 0); g.restore();
  g.font = `700 196px "Sohne", sans-serif`; g.fillStyle = BLUE; g.fillText("2027", 76, 880);
  g.font = `500 32px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = PAPER; g.globalAlpha = 0.66;
  g.fillText("PROJECT SHOWCASE · MARCH 2027", 80, 960); g.globalAlpha = 1;
  // The name line and the tag.
  g.strokeStyle = "rgba(241,255,255,0.35)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(80, 1190); g.lineTo(W - 80, 1190); g.stroke();
  g.font = `500 28px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = PAPER; g.globalAlpha = 0.5;
  g.fillText("NAME", 80, 1232); g.globalAlpha = 1;
  roundRect(g, 80, 1270, 230, 76, 38); g.fillStyle = BLUE; g.fill();
  g.font = `600 34px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = INK; g.fillText("GUEST", 132, 1320);
}

/** The back: the mark, big, and the address. */
function paintBack(g: CanvasRenderingContext2D) {
  const W = 1024, H = 1440;
  roundRect(g, 0, 0, W, H, 56); g.fillStyle = INK; g.fill();
  g.save(); roundRect(g, 0, 0, W, H, 56); g.clip(); drawField(g, W, H, "TETHOS · BUILT FOR PURPOSE · ", 0.08); g.restore();
  roundRect(g, W / 2 - 90, 44, 180, 30, 15); g.fillStyle = "#000"; g.fill();
  drawMark(g, W / 2 - 300, 420, 600, PAPER);
  g.font = `500 34px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = PAPER; g.globalAlpha = 0.6;
  g.textAlign = "center"; g.fillText("TETHOS.CA", W / 2, 1300); g.textAlign = "left"; g.globalAlpha = 1;
}

/** The strap: blue, printed with the event, repeating. */
function paintStrap(g: CanvasRenderingContext2D) {
  g.fillStyle = BLUE; g.fillRect(0, 0, 1024, 96);
  g.font = `600 44px "Sohne Mono", ui-monospace, monospace`; g.fillStyle = PAPER; g.textBaseline = "middle";
  g.fillText("GENESIS 2027 · TETHOS · ", 24, 50);
}

extend({ MeshLineGeometry, MeshLineMaterial });

type LanyardProps = {
  position?: [number, number, number];
  gravity?: [number, number, number];
  fov?: number;
  transparent?: boolean;
  /** false: the scene stops drawing (off screen). */
  active?: boolean;
};

export default function Lanyard({
  position = [0, 0, 30],
  gravity = [0, -40, 0],
  fov = 20,
  transparent = true,
  active = true,
}: LanyardProps) {
  // Touch screens can't drag the card (it would fight the page scroll); it still swings in and hangs.
  const [touch] = useState(() => typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={styles.lanyardWrapper}>
      <Canvas
        frameloop={active ? "always" : "never"}
        style={touch ? { pointerEvents: "none", touchAction: "pan-y" } : undefined}
        camera={{ position, fov }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: transparent }}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color(0x000000), transparent ? 0 : 1)
        }
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={gravity} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band isMobile={isMobile} />
        </Physics>
        <Environment blur={0.75}>
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="white"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

type BandProps = {
  maxSpeed?: number;
  minSpeed?: number;
  isMobile?: boolean;
};

function Band({ maxSpeed = 50, minSpeed = 0, isMobile = false }: BandProps) {
  const band = useRef<THREE.Mesh>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps = {
    type: "dynamic",
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  } as const;

  const [front] = useState(() => canvasTexture(1024, 1440, paintFront));
  const [back] = useState(() => canvasTexture(1024, 1440, paintBack));
  const [texture] = useState(() => canvasTexture(1024, 96, paintStrap));

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ])
  );
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.5, 0],
  ]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }

    if (fixed.current && j3.current && j2.current && j1.current && card.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) {
          ref.current.lerped = new THREE.Vector3().copy(
            ref.current.translation()
          );
        }
        const clampedDistance = Math.max(
          0.1,
          Math.min(1, ref.current.lerped.distanceTo(ref.current.translation()))
        );
        ref.current.lerped.lerp(
          ref.current.translation(),
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });

      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());

      (band.current?.geometry as any)?.setPoints(
        curve.getPoints(isMobile ? 16 : 32)
      );

      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  curve.curveType = "chordal";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const target = event.target as unknown as HTMLElement;
    target.releasePointerCapture(event.pointerId);
    drag(false);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const target = event.target as unknown as HTMLElement;
    target.setPointerCapture(event.pointerId);
    drag(new THREE.Vector3().copy(event.point).sub(vec.copy(card.current.translation())));
  };

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={handlePointerUp}
            onPointerDown={handlePointerDown}
          >
            {/* The card: a thin rounded slab with its two printed faces, glossy like a laminated pass. */}
            <RoundedBox args={[CARD_W, CARD_H, 0.016]} radius={0.007} smoothness={2}>
              <meshPhysicalMaterial color={INK} roughness={0.5} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.2} />
            </RoundedBox>
            <mesh position={[0, 0, 0.0085]}>
              <planeGeometry args={[CARD_W, CARD_H]} />
              <meshPhysicalMaterial map={front} transparent alphaTest={0.5} roughness={0.35} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.12} />
            </mesh>
            <mesh position={[0, 0, -0.0085]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[CARD_W, CARD_H]} />
              <meshPhysicalMaterial map={back} transparent alphaTest={0.5} roughness={0.35} clearcoat={isMobile ? 0 : 1} clearcoatRoughness={0.12} />
            </mesh>
            {/* The clip: a metal clamp through the slot, up to where the strap is tied. */}
            <mesh position={[0, CARD_H / 2 + 0.05, 0]}>
              <boxGeometry args={[0.2, 0.16, 0.05]} />
              <meshStandardMaterial color="#c9ced3" metalness={1} roughness={0.28} />
            </mesh>
            <mesh position={[0, CARD_H / 2 + 0.24, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.1, 0.022, 12, 32]} />
              <meshStandardMaterial color="#c9ced3" metalness={1} roughness={0.25} />
            </mesh>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        {/* @ts-expect-error - meshline extends R3F */}
        <meshLineGeometry />
        {/* @ts-expect-error - meshline extends R3F */}
        <meshLineMaterial
          color="white"
          depthTest={true}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
          map={texture}
          repeat={[-4, 1]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}
