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
  active: boolean;
  stats?: Record<string, string>;
  /** Only on partner nodes – links back to the chapter that ran the project */
  chapterId?: string;
  founded?: string;
  semester?: string;
}

/* ═══════════════════════════════════════════
   Constants & helpers
   ═══════════════════════════════════════════ */

const GLOBE_RADIUS = 100; // three-globe native radius – work at native scale

/** Merge chapters + partners into a single flat node list for rendering. */
const ALL_NODES: GlobeNodeData[] = [
  ...((globeData.chapters ?? []) as GlobeNodeData[]),
  ...((globeData.partners ?? []) as GlobeNodeData[]),
];

/** Only show active nodes on the globe. */
const NODES = ALL_NODES.filter((n) => n.active);

/** Auto-generate edges: each active partner connects to its chapter. */
const EDGES = NODES.filter((n) => n.type === "partner" && n.chapterId).map(
  (partner) => ({
    from: partner.chapterId!,
    to: partner.id,
  })
);

/* ═══════════════════════════════════════════
   Elevation lookup – approximate average elevation
   per country in metres (publicly known data).
   Used to give hex tiles a subtle 3D topology effect.
   ═══════════════════════════════════════════ */

const COUNTRY_ELEVATION: Record<string, number> = {
  AFG: 1884, ALB: 708, DZA: 800, AND: 1996, AGO: 1023,
  ARG: 595, ARM: 1792, AUS: 330, AUT: 910, AZE: 384,
  BGD: 85, BLR: 160, BEL: 181, BTN: 3280, BOL: 1192,
  BIH: 500, BWA: 1013, BRA: 320, BGR: 472, BFA: 297,
  KHM: 48, CMR: 667, CAN: 487, TCD: 543, CHL: 1871,
  CHN: 1840, COL: 593, COD: 726, CRI: 746, HRV: 331,
  CUB: 108, CZE: 433, DNK: 34, ECU: 1117, EGY: 321,
  SLV: 442, ERI: 853, EST: 61, ETH: 1330, FIN: 164,
  FRA: 375, GAB: 377, GEO: 1432, DEU: 263, GHA: 190,
  GRC: 498, GTM: 759, GIN: 472, GUY: 207, HTI: 470,
  HND: 684, HUN: 143, ISL: 557, IND: 621, IDN: 367,
  IRN: 1305, IRQ: 312, IRL: 118, ISR: 508, ITA: 538,
  JAM: 340, JPN: 438, JOR: 812, KAZ: 387, KEN: 762,
  KGZ: 2988, LAO: 710, LVA: 87, LBN: 1250, LSO: 2161,
  LBR: 243, LBY: 393, LTU: 110, LUX: 325, MKD: 741,
  MDG: 615, MWI: 779, MYS: 538, MLI: 343, MEX: 1111,
  MNG: 1528, MAR: 909, MOZ: 345, MMR: 702, NAM: 1141,
  NPL: 2565, NLD: 30, NZL: 388, NIC: 298, NER: 474,
  NGA: 380, NOR: 460, OMN: 310, PAK: 900, PAN: 360,
  PRY: 178, PER: 1555, PHL: 442, POL: 173, PRT: 372,
  QAT: 28, ROU: 414, RUS: 600, RWA: 1598, SAU: 665,
  SEN: 69, SRB: 473, SLE: 279, SGP: 15, SVK: 458,
  SVN: 492, SOM: 410, ZAF: 1034, KOR: 282, ESP: 660,
  LKA: 228, SDN: 568, SWE: 320, CHE: 1350, SYR: 514,
  TWN: 1150, TJK: 3186, TZA: 1018, THA: 287, TGO: 236,
  TUN: 246, TUR: 1132, TKM: 230, UGA: 1100, UKR: 175,
  ARE: 149, GBR: 162, USA: 760, URY: 109, UZB: 353,
  VEN: 450, VNM: 398, YEM: 999, ZMB: 1138, ZWE: 961,
};

const MAX_ELEVATION = 3280; // Bhutan – highest average
const MIN_ALT = 0.001; // hex altitude floor (globe-radius units)
const MAX_ALT = 0.006; // hex altitude ceiling

/** Map a country feature to a subtle hex altitude based on its average elevation. */
function hexAltitudeForFeature(feature: any): number {
  const iso = feature?.properties?.ISO_A3;
  const elev = iso && COUNTRY_ELEVATION[iso] !== undefined
    ? COUNTRY_ELEVATION[iso]
    : 400; // fallback for unlisted countries
  const t = Math.min(elev / MAX_ELEVATION, 1);
  return MIN_ALT + t * (MAX_ALT - MIN_ALT);
}

/** Map a country feature to a hex color that subtly varies with elevation. */
function hexColorForFeature(feature: any): string {
  const iso = feature?.properties?.ISO_A3;
  const elev = iso && COUNTRY_ELEVATION[iso] !== undefined
    ? COUNTRY_ELEVATION[iso]
    : 400;
  const t = Math.min(elev / MAX_ELEVATION, 1);
  // Low elevation → lighter/more transparent, high elevation → more saturated/opaque
  const r = Math.round(90 + (1 - t) * 40);   // 90-130
  const g = Math.round(120 + (1 - t) * 30);   // 120-150
  const b = Math.round(180 + (1 - t) * 20);   // 180-200
  const a = (0.5 + t * 0.4).toFixed(2);       // 0.50-0.90
  return `rgba(${r},${g},${b}, ${a})`;
}

/** Convert latitude / longitude to a position on the sphere surface.
 *  Three-globe convention: prime meridian (lng=0) faces +Z.
 */
function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lng * (Math.PI / 180);
  const r = radius + 1; // slightly above the surface
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.sin(theta),  // x from sin(theta) - east/west
    r * Math.cos(phi),                     // y from latitude
    r * Math.sin(phi) * Math.cos(theta)   // z from cos(theta) - prime meridian faces +Z
  );
}

/** Build arcsData array for three-globe from our auto-generated edges. */
function buildArcsData() {
  const nodeMap = new Map<string, GlobeNodeData>();
  NODES.forEach((n) => nodeMap.set(n.id, n));

  return EDGES.map((edge, i) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return null;

    // Compute arc altitude based on angular distance (longer arcs fly higher)
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
  }).filter((arc): arc is NonNullable<typeof arc> => arc !== null);
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
        .hexPolygonResolution(4)
        .hexPolygonMargin(0.15)
        .hexPolygonAltitude((e: any) => hexAltitudeForFeature(e))
        .showAtmosphere(true)
        .atmosphereColor("#b3c5ff")
        .atmosphereAltitude(0.25)
        .hexPolygonColor((e: any) => hexColorForFeature(e));

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
    NODES.forEach((n) => {
      map.set(n.id, latLngToVector3(n.lat, n.lng, GLOBE_RADIUS));
    });
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

      {/* Chapter and partner nodes */}
      <group>
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
      </group>

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
