"use client";

/**
 * /lab/volleyball: the match on a court of its own (flat sand, the same Court, VolleyMatch and HUD as the island), for
 * testing and evidence. You are drawn here (your saved look); on the island your own avatar plays through its ride.
 * Dev only (the /lab layout 404s in production). URL: ?seed=N repeats a match, ?bots=1 lets a bot play your place (the
 * camera stays on it).
 */
import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import Court from "./Court";
import VolleyMatch from "./VolleyMatch";
import VolleyHud from "./VolleyHud";
import { startVolley, stopVolley, useVolley, type CourtSpot } from "@/lib/game/volleyball/session";
import { useMyLook } from "@/lib/game/character/lookStore";

const SPOT: CourtSpot = { x: 0, z: 0, yaw: 0, y: 0 };
const FLAT = () => 0;
const WORLD = { top: () => 0, wet: () => false };

/** Module scope: a texture from a hook is frozen to the react compiler inside component code. */
function tile(map: THREE.Texture) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(24, 24); map.colorSpace = THREE.SRGBColorSpace; return map; }

function Sand() {
  const raw = useLoader(THREE.TextureLoader, "/assets/game/terrain/sand-albedo.png");
  const map = useMemo(() => tile(raw), [raw]);
  return <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}

export default function VolleyLab() {
  const playing = useVolley();
  const { look } = useMyLook();
  useEffect(() => {
    const q = new URLSearchParams(location.search), seed = Number(q.get("seed")) || undefined;
    startVolley(SPOT, FLAT, WORLD, seed, q.get("bots") !== "1");
    return () => stopVolley();
  }, []);
  return (
    <main className="gui" style={{ position: "fixed", inset: 0, background: "#bfe3f2" }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 60, near: 0.1, far: 200, position: [0, 3, -12] }} gl={{ antialias: true }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <color attach="background" args={["#bfe3f2"]} />
        <fog attach="fog" args={["#bfe3f2", 30, 80]} />
        <hemisphereLight args={["#fff6e5", "#d9c49a", 1.4]} />
        <directionalLight position={[8, 14, -6]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} />
        <Suspense fallback={null}>
          <Sand />
          <Court spot={SPOT} ground={FLAT} close={playing} />
          {playing && <VolleyMatch spot={SPOT} selfLook={look} />}
        </Suspense>
      </Canvas>
      <VolleyHud />
    </main>
  );
}
