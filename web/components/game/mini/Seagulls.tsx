"use client";

/**
 * Seagulls — the rigged, animated gull David supplied (2026-07-26),
 * ported from the game branch's AmbientLife with the bench values it
 * shipped with baked in as constants. Each bird orbits an anchor on the
 * organic path in lib/game/gullPath.ts, banking into its turns.
 */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { gullPose, type GullParams } from "@/lib/game/gullPath";

const SEAGULL_URL = "/assets/fauna/seagull.glb";
useGLTF.preload(SEAGULL_URL);

// Shipped bench values (game branch, tuning.ts `gull`).
const G = {
  flap: 5.15,
  flapSpread: 0.75,
  orbitSpeed: 0.6,
  orbitRadius: 6.5,
  altitude: 8,
  bob: 1.4,
  scale: 0.075,
  bank: 0.54,
  bankGain: 0.9,
  wobble: 0.26,
  drift: 3.5,
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Gull({ anchor, seed }: { anchor: [number, number]; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const { phase, jSpeed, jRadius, jAlt } = useMemo(() => {
    const rng = seededRandom(seed * 409 + 7);
    return { phase: rng() * Math.PI * 2, jSpeed: rng() * 0.05, jRadius: rng() * 3.5, jAlt: rng() * 2 };
  }, [seed]);

  const params = useRef<GullParams>({
    anchorX: anchor[0],
    anchorZ: anchor[1],
    speed: G.orbitSpeed + jSpeed,
    radius: G.orbitRadius + jRadius,
    altitude: G.altitude + jAlt,
    bob: G.bob,
    wobble: G.wobble,
    drift: G.drift,
    phase,
  });

  useFrame((state) => {
    if (!ref.current) return;
    const pose = gullPose(state.clock.elapsedTime, params.current, G.bankGain, G.bank);
    ref.current.position.set(pose.x, pose.y, pose.z);
    ref.current.rotation.y = pose.yaw;
    ref.current.rotation.z = pose.roll;
  });

  return (
    // YXZ so rotation.z is applied innermost, about the body's own forward
    // axis: that is roll, the bank into the turn.
    <group ref={ref} rotation={[0, 0, 0, "YXZ"]} position={[anchor[0], G.altitude, anchor[1]]}>
      <Suspense fallback={null}>
        <SeagullModel seed={seed} />
      </Suspense>
    </group>
  );
}

/**
 * Each instance needs its own skeleton and mixer: SkeletonUtils.clone,
 * not Object3D.clone, or every copy resolves against the same bones.
 */
function SeagullModel({ seed }: { seed: number }) {
  const { scene, animations } = useGLTF(SEAGULL_URL);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const body = useMemo(() => {
    const c = cloneSkeleton(scene);
    c.scale.setScalar(G.scale);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false; // skinned bounds do not follow the animation
    });
    return c;
  }, [scene]);

  useEffect(() => {
    if (!animations.length) return;
    const mixer = new THREE.AnimationMixer(body);
    const action = mixer.clipAction(animations[0]);
    action.play();
    action.time = (seed * 0.37) % (animations[0].duration || 1);
    mixer.timeScale = G.flap + ((seed * 13) % 7) * (G.flapSpread / 7);
    mixerRef.current = mixer;
    return () => {
      action.stop();
      mixer.uncacheRoot(body);
      mixerRef.current = null;
    };
  }, [body, animations, seed]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return <primitive object={body} />;
}

export default function Seagulls({ anchors }: { anchors: [number, number][] }) {
  return (
    <group>
      {anchors.map((a, i) => (
        <Gull key={i} anchor={a} seed={i + 3} />
      ))}
    </group>
  );
}
