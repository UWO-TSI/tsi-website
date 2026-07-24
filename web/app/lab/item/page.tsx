"use client";

/**
 * /lab/item — isolated GLB inspector (2026-07-22).
 *
 * The extraction-doctrine tool: browse every .glb under public/, orbit it
 * (drag to top-down — catches sideways skin-bakes), toggle the +90°X fix,
 * check scale against a player-height (1.4u) reference, read bbox size +
 * material/mesh counts. No game systems mounted — pure isolation.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

interface Measure {
  size: [number, number, number];
  meshes: number;
  materials: number;
}

function Model({
  url,
  fixRot,
  onMeasure,
}: {
  url: string;
  fixRot: boolean;
  onMeasure: (m: Measure) => void;
}) {
  const { scene } = useGLTF(url);
  // SkeletonUtils.clone: skinned dump models ignore the fixRot wrapper with
  // a plain clone (they stay bound to the original skeleton).
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const s = new THREE.Vector3();
    box.getSize(s);
    let meshes = 0;
    const mats = new Set<string>();
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        meshes++;
        const m = mesh.material;
        (Array.isArray(m) ? m : [m]).forEach((mm) => mats.add(mm.uuid));
      }
    });
    onMeasure({ size: [s.x, s.y, s.z], meshes, materials: mats.size });
  }, [cloned, onMeasure]);

  return (
    <group rotation-x={fixRot ? Math.PI / 2 : 0}>
      <primitive object={cloned} />
    </group>
  );
}

export default function ItemBench() {
  const [assets, setAssets] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [fixRot, setFixRot] = useState(false);
  const [showRef, setShowRef] = useState(true);
  const [measure, setMeasure] = useState<Measure | null>(null);

  useEffect(() => {
    fetch("/api/lab/assets")
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((d) => setAssets(d.assets ?? []))
      .catch(() => setAssets([]));
  }, []);

  const visible = assets.filter((a) => a.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ display: "flex", height: "calc(100vh - 40px)", fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Browser */}
      <div
        style={{
          width: 300,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <input
          placeholder={`filter ${assets.length} assets…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            margin: 10,
            padding: "6px 10px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            color: "#f1ffff",
            fontFamily: "inherit",
            fontSize: 11,
          }}
        />
        <div style={{ overflowY: "auto", flex: 1, padding: "0 6px 10px" }}>
          {visible.map((a) => (
            <button
              key={a}
              onClick={() => {
                setSelected(a);
                setMeasure(null);
                setFixRot(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "4px 8px",
                marginBottom: 2,
                fontSize: 10,
                fontFamily: "inherit",
                background: selected === a ? "rgba(255,209,102,0.18)" : "transparent",
                border: "none",
                borderRadius: 4,
                color: selected === a ? "#FFD166" : "#c9d1d6",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={a}
            >
              {a.replace("/assets/", "")}
            </button>
          ))}
          {visible.length === 0 && (
            <div style={{ padding: 10, fontSize: 11, color: "#8a939a" }}>no matches</div>
          )}
        </div>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, position: "relative" }}>
        <Canvas camera={{ position: [3, 2.2, 3.6], fov: 45 }} style={{ background: "#12161f" }}>
          <ambientLight intensity={0.7} />
          <hemisphereLight args={["#cfe8ff", "#4a3f33", 0.5]} />
          <directionalLight position={[4, 6, 3]} intensity={1.4} />
          <gridHelper args={[10, 20, "#3a4250", "#232a36"]} />
          {showRef && (
            /* player-height reference: 1.4u tall, 0.5u wide */
            <mesh position={[-1.2, 0.7, 0]}>
              <boxGeometry args={[0.5, 1.4, 0.24]} />
              <meshStandardMaterial color="#FFD166" transparent opacity={0.28} />
            </mesh>
          )}
          {selected && (
            <Suspense fallback={null}>
              <Model url={selected} fixRot={fixRot} onMeasure={setMeasure} />
            </Suspense>
          )}
          <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        </Canvas>

        {/* Toolbar */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 11,
          }}
        >
          <button onClick={() => setFixRot((f) => !f)} style={toolBtn(fixRot)}>
            +90°X fix {fixRot ? "ON" : "off"}
          </button>
          <button onClick={() => setShowRef((s) => !s)} style={toolBtn(showRef)}>
            player ref {showRef ? "ON" : "off"}
          </button>
        </div>

        {/* Readout */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            padding: "8px 12px",
            background: "rgba(11,14,20,0.9)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            fontSize: 10,
            color: "#c9d1d6",
            lineHeight: 1.7,
          }}
        >
          {selected ? (
            <>
              <div style={{ color: "#FFD166" }}>{selected}</div>
              {measure ? (
                <>
                  <div>
                    bbox {measure.size.map((v) => v.toFixed(2)).join(" × ")} u
                    {" · "}player = 1.4u tall
                  </div>
                  <div>
                    {measure.meshes} mesh{measure.meshes === 1 ? "" : "es"} ·{" "}
                    {measure.materials} material{measure.materials === 1 ? "" : "s"}
                  </div>
                </>
              ) : (
                <div>measuring…</div>
              )}
              <div style={{ color: "#8a939a" }}>drag = orbit · drag to top-down to check for sideways bakes</div>
            </>
          ) : (
            <div>pick an asset from the list</div>
          )}
        </div>
      </div>
    </div>
  );
}

function toolBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    fontSize: 10,
    fontFamily: "'IBM Plex Mono', monospace",
    background: active ? "rgba(255,209,102,0.22)" : "rgba(11,14,20,0.85)",
    border: `1px solid ${active ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.18)"}`,
    borderRadius: 6,
    color: "#f1ffff",
    cursor: "pointer",
  };
}
