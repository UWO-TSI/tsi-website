"use client";

/**
 * /lab/interior — interior room bench (loop wake 42). Dev-only.
 * Mounts any of the three rooms directly — no world walk + E-entry needed
 * (which the headless harness can't drive; this bench closes that
 * verification gap). Same tone mapping as the game Canvas; WASD/click-move
 * works via the room's own InteriorPlayer; drag to orbit for inspection.
 * Params: ?room=oracle|shop|hq (default oracle)
 */

import { useRef, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import HQInterior from "@/components/game/HQInterior";
import ShopInterior from "@/components/game/ShopInterior";
import OracleInterior from "@/components/game/OracleInterior";

const ROOMS = ["oracle", "shop", "hq"] as const;

export default function InteriorBench() {
  // Client-only mount gate: room comes from window.location.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const playerPosRef = useRef(new THREE.Vector3(0, 0, -4.2));
  if (!ready) return null;
  const room = new URLSearchParams(window.location.search).get("room") ?? "oracle";
  const Room = room === "hq" ? HQInterior : room === "shop" ? ShopInterior : OracleInterior;
  return (
    <div style={{ height: "calc(100vh - 40px)", position: "relative" }}>
      <div style={{ position: "absolute", top: 10, left: 12, zIndex: 10, display: "flex", gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
        {ROOMS.map((r) => (
          <a
            key={r}
            href={`/lab/interior?room=${r}`}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              color: "#f1ffff",
              textDecoration: "none",
              background: r === room ? "rgba(255,209,102,0.25)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${r === room ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.16)"}`,
            }}
          >
            {r}
          </a>
        ))}
        <span style={{ color: "#8a939a", alignSelf: "center" }}>WASD / click to move · drag to orbit</span>
      </div>
      <Canvas
        camera={{ fov: 48, near: 0.1, far: 100, position: [0, 6.5, -9.5] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Room frozen={false} playerPosRef={playerPosRef} onNearestStation={() => {}} />
        <OrbitControls target={[0, 1.2, 1]} enablePan={false} minDistance={4} maxDistance={16} />
      </Canvas>
    </div>
  );
}
