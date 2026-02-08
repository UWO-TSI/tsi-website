"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type ThreeGlobeType from "three-globe";
import styles from "./GlobeVisualizer.module.css";
import globeData from "@/data/globe-nodes.json";
import countries from "@/data/globe-countries.json";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface GlobeNodeData {
  id: string;
  type: "chapter" | "partner";
  lat: number;
  lng: number;
  label: string;
  title: string;
  description: string;
  image?: string;
  stats?: Record<string, string>;
}

interface GlobeEdgeData {
  from: string;
  to: string;
  arrowDuration?: number;
}

/* ═══════════════════════════════════════════
   Constants & helpers
   ═══════════════════════════════════════════ */

const GLOBE_RADIUS = 100; // three-globe native radius – work at native scale
const NODES = globeData.nodes as GlobeNodeData[];
const EDGES = globeData.edges as GlobeEdgeData[];

/** Convert latitude / longitude to a position on the sphere surface. */
function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const r = radius + 1; // slightly above the surface
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Build arcsData array for three-globe from our nodes & edges. */
function buildArcsData() {
  const nodeMap = new Map<string, GlobeNodeData>();
  NODES.forEach((n) => nodeMap.set(n.id, n));

  return EDGES.map((edge, i) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return null;

    // Compute arc altitude based on angular distance (longer = higher)
    const dLat = Math.abs(from.lat - to.lat);
    const dLng = Math.abs(from.lng - to.lng);
    const angularDist = Math.sqrt(dLat * dLat + dLng * dLng);
    const arcAlt = Math.min(Math.max(angularDist / 180, 0.06), 0.35);

    return {
      startLat: from.lat,
      startLng: from.lng,
      endLat: to.lat,
      endLng: to.lng,
      arcAlt,
      order: i + 1,
      status: true,
    };
  }).filter(Boolean);
}

const ARCS_DATA = buildArcsData();

/* ═══════════════════════════════════════════
   GlobeSphere – three-globe hex polygon globe
   with native arcs (github-globe style)
   ═══════════════════════════════════════════ */

function GlobeSphere() {
  const [globe, setGlobe] = useState<ThreeGlobeType | null>(null);

  useEffect(() => {
    import("three-globe").then((mod) => {
      const ThreeGlobe = mod.default;
      const g = new ThreeGlobe({
        waitForGlobeReady: true,
        animateIn: true,
      })
        .hexPolygonsData((countries as any).features)
        .hexPolygonResolution(3)
        .hexPolygonMargin(0.7)
        .showAtmosphere(true)
        .atmosphereColor("#b3c5ff")
        .atmosphereAltitude(0.25)
        .hexPolygonColor((e: any) => {
          if (
            ["KGZ", "KOR", "THA", "RUS", "UZB", "IDN", "KAZ", "MYS"].includes(
              e.properties.ISO_A3
            )
          ) {
            return "rgba(100,130,200, 0.9)";
          } else return "rgba(120,140,180, 0.6)";
        });

      // Add arcs after globe is ready (like github-globe)
      setTimeout(() => {
        g.arcsData(ARCS_DATA)
          .arcColor(() => "#9cff00")
          .arcAltitude((d: any) => d.arcAlt)
          .arcStroke(() => 0.5)
          .arcDashLength(0.9)
          .arcDashGap(4)
          .arcDashAnimateTime(1000)
          .arcsTransitionDuration(1000)
          .arcDashInitialGap((d: any) => d.order * 1);
      }, 1000);

      // Style the globe material – WHITE globe
      const mat = g.globeMaterial() as THREE.MeshPhongMaterial;
      mat.color = new THREE.Color(0xffffff);
      mat.emissive = new THREE.Color(0xd4e0ff);
      mat.emissiveIntensity = 0.1;
      mat.shininess = 0.9;

      // Tilt the globe slightly for visual interest
      g.rotateY(-Math.PI * (5 / 9));
      g.rotateZ(-Math.PI / 6);

      setGlobe(g);
    });
  }, []);

  if (!globe) return null;
  return <primitive object={globe} />;
}

/* ═══════════════════════════════════════════
   GlobeNode – sphere on the surface + hover card
   ═══════════════════════════════════════════ */

function GlobeNode({
  node,
  position,
  onHoverChange,
}: {
  node: GlobeNodeData;
  position: THREE.Vector3;
  onHoverChange?: (hovered: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const isChapter = node.type === "chapter";
  const nodeRadius = isChapter ? 2 : 1.2;
  const color = isChapter ? "#6b8cff" : "#a0a0b0";
  const emissive = isChapter ? "#3a6aff" : "#666680";

  const _scaleVec = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    // Smooth hover scale
    const target = hovered ? 1.6 : 1;
    _scaleVec.set(target, target, target);
    meshRef.current.scale.lerp(_scaleVec, 0.15);

    // Pulsing glow for chapter nodes
    if (isChapter && glowRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.15;
      glowRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={position}>
      {/* Glow halo (chapter only) */}
      {isChapter && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[nodeRadius * 2.5, 16, 16]} />
          <meshBasicMaterial color="#3a6aff" transparent opacity={0.2} />
        </mesh>
      )}

      {/* Node dot */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHoverChange?.(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHoverChange?.(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[nodeRadius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={hovered ? 2.5 : isChapter ? 0.8 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Hover card (drei Html) */}
      {hovered && (
        <Html center style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
          <div className={styles.hoverCard}>
            {node.image && (
              <img
                className={styles.hoverCardImage}
                src={node.image}
                alt={node.title}
              />
            )}
            <div className={styles.hoverCardBody}>
              <span
                className={`${styles.badge} ${
                  isChapter ? styles.badgeChapter : styles.badgePartner
                }`}
              >
                {isChapter ? "Chapter" : "Partner"}
              </span>
              <h4 className={styles.hoverCardTitle}>{node.title}</h4>
              <p className={styles.hoverCardDesc}>{node.description}</p>
              {node.stats && (
                <div className={styles.statsGrid}>
                  {Object.entries(node.stats).map(([key, value]) => (
                    <div key={key} className={styles.stat}>
                      <span className={styles.statValue}>{value}</span>
                      <span className={styles.statLabel}>{key}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════
   GlobeScene – assembles everything inside the Canvas
   ═══════════════════════════════════════════ */

function GlobeScene() {
  const [anyNodeHovered, setAnyNodeHovered] = useState(false);
  const hoverCountRef = useRef(0);
  const { camera } = useThree();

  const handleNodeHoverChange = (hovered: boolean) => {
    hoverCountRef.current += hovered ? 1 : -1;
    setAnyNodeHovered(hoverCountRef.current > 0);
  };

  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    NODES.forEach((n) =>
      map.set(n.id, latLngToVector3(n.lat, n.lng, GLOBE_RADIUS))
    );
    return map;
  }, []);

  // Attach lights to camera for dramatic shading
  useEffect(() => {
    const dLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dLight.position.set(-800, 2000, 400);
    camera.add(dLight);

    const dLight1 = new THREE.DirectionalLight(0x7982f6, 1);
    dLight1.position.set(-200, 500, 200);
    camera.add(dLight1);

    const pLight = new THREE.PointLight(0x8566cc, 0.5);
    pLight.position.set(-200, 500, 200);
    camera.add(pLight);

    return () => {
      camera.remove(dLight);
      camera.remove(dLight1);
      camera.remove(pLight);
    };
  }, [camera]);

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.6} color={0xffffff} />

      {/* Globe with built-in arcs */}
      <GlobeSphere />

      {/* Nodes */}
      {NODES.map((node) => {
        const pos = nodePositions.get(node.id);
        if (!pos) return null;
        return (
          <GlobeNode
            key={node.id}
            node={node}
            position={pos}
            onHoverChange={handleNodeHoverChange}
          />
        );
      })}

      {/* Controls – rotate only, pause auto-rotate when hovering a node */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.5}
        autoRotate={!anyNodeHovered}
        autoRotateSpeed={0.3}
      />
    </>
  );
}

/* ═══════════════════════════════════════════
   GlobeVisualizer – exported wrapper
   ═══════════════════════════════════════════ */

export default function GlobeVisualizer({
  className = "",
}: {
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  // SSR guard – Canvas uses browser APIs
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className={`${styles.container} ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 300], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
}
