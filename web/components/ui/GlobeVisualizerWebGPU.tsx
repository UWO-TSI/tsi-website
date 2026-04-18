"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Color, DirectionalLight, DoubleSide, Material, Mesh, Points, Vector3, QuadraticBezierCurve3, BufferGeometry, LineDashedMaterial, Line } from "three";
import {
    ACESFilmicToneMapping,
    SRGBColorSpace,
    WebGPURenderer,
    PointsNodeMaterial,
    PostProcessing,
} from "three/webgpu";
import type { UniformNode } from "three/webgpu";
import { attribute, float, fract, smoothstep, uniform, vec3, pass } from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import globeData from "@/data/globe-nodes.json";

// ═══════════════════════════════════════════
// Config
// ═══════════════════════════════════════════

const CONFIG = {
    topography: 0.10,
    background: "#10121a",
    land: "#6b9362",
    water: "#181a25",
    blend: 1.00,
    opacity: 0.75,
    glow: { radius: 0.72, strength: 0.62, threshold: 0.0 },
    light: { color: "#93d8ff", intensity: 1.6, exposure: 1.4 },
};

const GLOBE_RADIUS = 1.0;
const ROTATION_Y = 3.45;

// Module-level hover counter — GlobeNode writes, SceneContent reads
let _nodeHoverCount = 0;

// ═══════════════════════════════════════════
// Node types & data
// ═══════════════════════════════════════════

interface GlobeNodeData {
    id: string;
    type: "chapter" | "partner";
    lat: number;
    lng: number;
    label: string;
    title: string;
    description: string;
    active: boolean;
    chapterId?: string;
    stats?: Record<string, string>;
    semester?: string;
}

const ALL_NODES: GlobeNodeData[] = [
    ...((globeData.chapters ?? []) as GlobeNodeData[]),
    ...((globeData.partners ?? []) as GlobeNodeData[]),
];

const NODES = ALL_NODES.filter((n) => n.active);

const EDGES = NODES.filter((n) => n.type === "partner" && n.chapterId).map(
    (p) => ({ from: p.chapterId!, to: p.id })
);

/** Convert lat/lng to position on globe surface (matches depth globe coords) */
function latLngToVec3(lat: number, lng: number, r: number): Vector3 {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((90 - lng) * Math.PI) / 180;
    const s = r * 1.02;
    return new Vector3(
        s * Math.sin(phi) * Math.cos(theta),
        s * Math.cos(phi),
        s * Math.sin(phi) * Math.sin(theta)
    );
}

// ═══════════════════════════════════════════
// Point Material — from tsi-globe GlobeAnimated.tsx
// ═══════════════════════════════════════════

type MaterialUniforms = {
    animate: UniformNode<number>;
    scale: UniformNode<number>;
    time: UniformNode<number>;
    landColor: UniformNode<Color>;
    waterColor: UniformNode<Color>;
    blendFactor: UniformNode<number>;
    cameraDelta: UniformNode<Vector3>;
};

function pointMaterial(radius: number): {
    material: PointsNodeMaterial;
    uniforms: MaterialUniforms;
} {
    const direction = attribute("_direction");
    const elevation = attribute("_elevation");
    const land = attribute("_land");

    const animate = uniform(float(1.0));
    const scale = uniform(float(1.0));
    const time = uniform(float(0.0));
    const cameraDelta = uniform(vec3(0, 0, 0));
    const landColor = uniform(new Color());
    const waterColor = uniform(new Color());
    const blendFactor = uniform(0.75);

    const baseRadius = float(radius).add(elevation.mul(scale.mul(0.84)));
    const targetRadius = float(radius).add(elevation.mul(scale));
    const travelTime = float(3.6);
    const distance = targetRadius.sub(baseRadius);
    const directionHash = direction
        .dot(vec3(12.9898, 78.233, 37.719))
        .sin()
        .mul(float(43758.5453))
        .fract();
    const offset = directionHash.add(elevation.mul(0.36)).fract();
    const phase = fract(time.div(travelTime).add(offset));
    const easedT = phase.mul(phase).mul(float(3.0).sub(phase.mul(2.1)));
    const wobbleAmount = float(0.006);
    const elevationWobbleScale = float(1.0).add(elevation.mul(3));
    const wobbleAxis = direction
        .cross(vec3(0.3, 1.0, 0.3))
        .add(direction.cross(vec3(1.0, 0.3, 0.3)))
        .normalize();
    const wobbleSignal = time.mul(float(3)).add(directionHash.mul(6)).sin();
    const wobbleEnvelope = easedT.mul(float(1.0).sub(easedT));
    const wobble = wobbleAxis
        .mul(wobbleSignal)
        .mul(wobbleEnvelope)
        .mul(wobbleAmount)
        .mul(elevationWobbleScale)
        .mul(land);
    const wobbledPosition = baseRadius.add(distance.mul(easedT)).add(wobble);
    const animatedPosition = targetRadius.add(
        wobbledPosition.sub(targetRadius).mul(animate)
    );

    const worldPosition = animatedPosition.mul(direction);
    const cameraMotion = cameraDelta.negate();
    const viewDirection = worldPosition.normalize().add(wobble.mul(150));
    const lateralMotion = cameraMotion.sub(
        viewDirection.mul(cameraMotion.dot(viewDirection))
    );
    const blurElevation = float(0.03);
    const blurFade = float(0.3);
    const elevationMask = smoothstep(
        blurElevation,
        blurElevation.add(blurFade),
        elevation
    );
    const blurFactor = elevation
        .mul(scale)
        .mul(9)
        .add(wobble.mul(scale))
        .mul(elevationMask)
        .mul(animate);

    const position = worldPosition.add(
        lateralMotion.mul(blurFactor)
    );

    const fadeThreshold = float(0.69);
    const rawFade = phase
        .sub(fadeThreshold)
        .div(float(1.0).sub(fadeThreshold))
        .clamp(0.0, 1.0);
    const smoothFade = rawFade
        .mul(rawFade)
        .mul(float(3.0).sub(rawFade.mul(2.0)));
    const fadeMask = elevation.greaterThanEqual(fadeThreshold).toFloat();
    const fade = float(1.0).sub(smoothFade.mul(fadeMask).mul(animate));

    const landLow = landColor
        .mul(float(1.0).sub(blendFactor))
        .add(waterColor.mul(blendFactor));
    const landElevated = landLow.add(landColor.sub(landLow).mul(elevation));
    const color = land.equal(1.0).select(landElevated, waterColor).mul(fade);

    const material = new PointsNodeMaterial({
        transparent: true
    });
    material.positionNode = position;
    material.colorNode = color;

    return {
        material,
        uniforms: {
            animate,
            scale,
            time,
            cameraDelta,
            landColor,
            waterColor,
            blendFactor
        }
    };
}

// ═══════════════════════════════════════════
// Arc Line between two nodes
// ═══════════════════════════════════════════

function ArcLine({ start, end }: { start: Vector3; end: Vector3 }) {
    const dotRef = useRef<Mesh>(null);

    const { curve, lineObj } = useMemo(() => {
        const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
        const dist = start.distanceTo(end);
        mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.5);

        const c = new QuadraticBezierCurve3(start, mid, end);
        const pts = c.getPoints(48);
        const geo = new BufferGeometry().setFromPoints(pts);
        const mat = new LineDashedMaterial({
            color: "#9cff00",
            dashSize: 0.02,
            gapSize: 0.01,
            opacity: 0.25,
            transparent: true,
        });
        const line = new Line(geo, mat);
        line.computeLineDistances();
        return { curve: c, lineObj: line };
    }, [start, end]);

    // Traveling light dot along the curve
    useFrame(({ clock }) => {
        if (dotRef.current) {
            const t = (clock.elapsedTime * 0.1875) % 1;
            const pos = curve.getPoint(t);
            dotRef.current.position.copy(pos);
        }
    });

    return (
        <>
            <primitive object={lineObj} />
            <mesh ref={dotRef}>
                <sphereGeometry args={[0.006, 8, 8]} />
                <meshBasicMaterial color="#9cff00" transparent opacity={0.9} />
            </mesh>
        </>
    );
}

// ═══════════════════════════════════════════
// Globe Node — dot on surface + hover label
// ═══════════════════════════════════════════

function GlobeNode({ node, position }: { node: GlobeNodeData; position: Vector3 }) {
    const [hovered, setHovered] = useState(false);
    const glowRef = useRef<Mesh>(null);
    const dotRef = useRef<Mesh>(null);
    const hoverRingRef = useRef<Mesh>(null);
    const isChapter = node.type === "chapter";
    const r = isChapter ? 0.018 : 0.01;
    const nodeColor = isChapter ? "#6b8cff" : "#9cff00";
    const hoverColor = isChapter ? "#a0b8ff" : "#c8ff50";
    const accentColor = isChapter ? "#3a6aff" : "#6b9362";

    useFrame(({ clock }) => {
        // Pulse glow ring for chapters
        if (isChapter && glowRef.current) {
            const pulse = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.15;
            glowRef.current.scale.set(pulse, pulse, pulse);
        }
        // Hover: scale up dot + pulse hover ring
        if (dotRef.current) {
            const targetScale = hovered ? 1.8 : 1;
            dotRef.current.scale.lerp(new Vector3(targetScale, targetScale, targetScale), 0.15);
        }
        if (hoverRingRef.current) {
            if (hovered) {
                const ring = 1 + Math.sin(clock.elapsedTime * 4) * 0.2;
                hoverRingRef.current.scale.set(ring, ring, ring);
                hoverRingRef.current.visible = true;
            } else {
                hoverRingRef.current.visible = false;
            }
        }
    });

    return (
        <group position={position}>
            {isChapter && (
                <mesh ref={glowRef}>
                    <sphereGeometry args={[r * 2.5, 12, 12]} />
                    <meshBasicMaterial color={accentColor} transparent opacity={0.15} />
                </mesh>
            )}

            {/* Hover pulse ring */}
            <mesh ref={hoverRingRef} visible={false}>
                <sphereGeometry args={[r * 3.5, 12, 12]} />
                <meshBasicMaterial color={hoverColor} transparent opacity={0.2} />
            </mesh>

            {/* Visible dot */}
            <mesh ref={dotRef}>
                <sphereGeometry args={[r, 12, 12]} />
                <meshBasicMaterial color={hovered ? hoverColor : nodeColor} />
            </mesh>

            {/* Invisible larger hitbox */}
            <mesh
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); _nodeHoverCount++; document.body.style.cursor = "pointer"; }}
                onPointerOut={(e) => { e.stopPropagation(); setHovered(false); _nodeHoverCount--; document.body.style.cursor = "auto"; }}
            >
                <sphereGeometry args={[r * 4, 12, 12]} />
                <meshBasicMaterial visible={false} />
            </mesh>

            {hovered && (
                <Html center style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
                    <div style={{
                        background: "rgba(8,8,12,0.95)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 0,
                        transform: "translateY(-140%)",
                        whiteSpace: "nowrap",
                        fontFamily: "var(--font-highlight), monospace",
                        color: "#f1ffff",
                        fontSize: 11,
                        boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 20px ${accentColor}15`,
                        overflow: "hidden",
                        minWidth: 180,
                    }}>
                        {/* Accent bar */}
                        <div style={{ height: 2, background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
                        <div style={{ padding: "10px 14px" }}>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 4,
                            }}>
                                <div style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    background: nodeColor,
                                    boxShadow: `0 0 6px ${nodeColor}`,
                                }} />
                                <span style={{
                                    fontSize: 9,
                                    color: nodeColor,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    fontWeight: 600,
                                }}>
                                    {isChapter ? "Chapter" : "Partner"}
                                </span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, letterSpacing: "-0.01em" }}>
                                {node.title}
                            </div>
                            {node.stats && (
                                <div style={{
                                    display: "flex",
                                    gap: 14,
                                    marginTop: 6,
                                    paddingTop: 6,
                                    borderTop: "1px solid rgba(255,255,255,0.06)",
                                }}>
                                    {Object.entries(node.stats).map(([k, v]) => (
                                        <div key={k} style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "#f1ffff" }}>{v}</div>
                                            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 1 }}>{k}</div>
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

// ═══════════════════════════════════════════
// Globe
// ═══════════════════════════════════════════

function Globe() {
    const { nodes } = useGLTF("/globe.glb");

    const pointsRef = useRef<Points | null>(null);
    const uniformsRef = useRef<MaterialUniforms | null>(null);
    const previousCameraPosition = useRef(new Vector3());
    const smoothedCameraDelta = useRef(new Vector3());
    const cameraDeltaVec = new Vector3();

    // Pre-compute node positions
    const nodePositions = useMemo(() => {
        const map = new Map<string, Vector3>();
        NODES.forEach((n) => map.set(n.id, latLngToVec3(n.lat, n.lng, GLOBE_RADIUS)));
        return map;
    }, []);

    useEffect(() => {
        const geometry = (nodes.GlobePoints as Points).geometry;
        const { material, uniforms } = pointMaterial(1.0);

        uniformsRef.current = uniforms;
        pointsRef.current!.geometry = geometry;
        pointsRef.current!.material = material as unknown as Material;

        uniforms.scale.value = CONFIG.topography;
        uniforms.landColor.value.set(CONFIG.land);
        uniforms.waterColor.value.set(CONFIG.water);
        uniforms.blendFactor.value = CONFIG.blend;
    }, [nodes]);

    useFrame((state, delta) => {
        const cameraPosition = state.camera.position;

        if (previousCameraPosition.current.lengthSq() > 0) {
            cameraDeltaVec.subVectors(
                cameraPosition,
                previousCameraPosition.current
            );

            const maximumDelta = 0.24;
            const clampedDelta = Math.min(delta, maximumDelta);
            const response = 6.0;
            const alpha = 1 - Math.exp(-response * clampedDelta);

            smoothedCameraDelta.current.lerp(cameraDeltaVec, alpha);
            smoothedCameraDelta.current.clampLength(0, maximumDelta);

            if (uniformsRef.current) {
                uniformsRef.current.cameraDelta.value.copy(
                    smoothedCameraDelta.current
                );
            }
        }

        previousCameraPosition.current.copy(cameraPosition);

        if (uniformsRef.current) {
            uniformsRef.current.time.value = state.clock.elapsedTime;
        }
    });

    return (
        <>
            <points ref={pointsRef} rotation={[0, ROTATION_Y, 0]} />
            <mesh geometry={(nodes.GlobeSphere as Mesh).geometry}>
                <meshStandardMaterial
                    color={CONFIG.water}
                    opacity={CONFIG.opacity}
                    side={DoubleSide}
                    transparent
                />
            </mesh>

            {/* Nodes + arcs — rotate with globe */}
            <group rotation={[0, ROTATION_Y, 0]}>
                {EDGES.map((edge) => {
                    const s = nodePositions.get(edge.from);
                    const e = nodePositions.get(edge.to);
                    if (!s || !e) return null;
                    return <ArcLine key={`${edge.from}-${edge.to}`} start={s} end={e} />;
                })}
                {NODES.map((node) => {
                    const pos = nodePositions.get(node.id);
                    if (!pos) return null;
                    return <GlobeNode key={node.id} node={node} position={pos} />;
                })}
            </group>
        </>
    );
}

// ═══════════════════════════════════════════
// Post Processing — WebGPU bloom
// ═══════════════════════════════════════════

function GlobePostProcessing({ children }: { children: ReactNode }) {
    const { camera, gl, scene } = useThree();
    const postProcessing = useRef<PostProcessing | null>(null);

    useEffect(() => {
        if (!gl) return;

        const pp = new PostProcessing(gl as unknown as any);
        const scenePass = pass(scene, camera);
        const sceneOutput = scenePass.getTextureNode("output");
        const bloomPass = bloom(sceneOutput);

        bloomPass.radius.value = CONFIG.glow.radius;
        bloomPass.strength.value = CONFIG.glow.strength;
        bloomPass.threshold.value = CONFIG.glow.threshold;

        pp.outputNode = sceneOutput.add(bloomPass);
        postProcessing.current = pp;

        return () => {
            pp.dispose?.();
        };
    }, [gl, scene, camera]);

    useFrame(() => {
        if (postProcessing.current) {
            postProcessing.current.render();
        }
    }, 1);

    return children;
}

// ═══════════════════════════════════════════
// Scene
// ═══════════════════════════════════════════

function SceneContent() {
    const { camera, gl, invalidate, scene } = useThree();
    const lightRef = useRef<DirectionalLight | null>(null);
    const [anyNodeHovered, setAnyNodeHovered] = useState(false);

    // Poll the module-level hover counter each frame
    useFrame(() => {
        const hovered = _nodeHoverCount > 0;
        if (hovered !== anyNodeHovered) setAnyNodeHovered(hovered);
    });

    if (!lightRef.current) {
        const light = new DirectionalLight("#ffffff", 0.6);
        light.position.set(0, -6, -3);
        lightRef.current = light;
    }

    useEffect(() => {
        const light = lightRef.current!;
        camera.add(light);
        scene.add(camera);
        return () => {
            camera.remove(light);
            scene.remove(camera);
        };
    }, [camera, scene]);

    useEffect(() => {
        scene.background = new Color(CONFIG.background);
    }, [scene]);

    useEffect(() => {
        if (lightRef.current) {
            lightRef.current.color.set(CONFIG.light.color);
            lightRef.current.intensity = CONFIG.light.intensity;
        }
    }, []);

    useEffect(() => {
        gl.toneMappingExposure = CONFIG.light.exposure;
    }, [gl]);

    useFrame(() => {
        invalidate();
    });

    return (
        <>
            <ambientLight intensity={CONFIG.light.intensity / 2} />
            <directionalLight
                position={[1.2, 0, 0.66]}
                color={CONFIG.light.color}
                intensity={CONFIG.light.intensity}
            />
            <Globe />
            <OrbitControls
                autoRotate={!anyNodeHovered}
                autoRotateSpeed={0.3}
                dampingFactor={0.03}
                enablePan={false}
                enableZoom={false}
                zoomSpeed={0.3}
            />
        </>
    );
}

// ═══════════════════════════════════════════
// Exported component
// ═══════════════════════════════════════════

export default function GlobeVisualizerWebGPU({ className = "" }: { className?: string }) {
    return (
        <div className={className} style={{ position: "relative", width: "100%", height: "100%", minHeight: 500 }}>
            <Canvas
                camera={{ position: [0, 1, 5.1], fov: 30 }}
                gl={async (props: any) => {
                    const renderer = new WebGPURenderer({
                        ...props,
                        alpha: true,
                    } as never);
                    renderer.toneMapping = ACESFilmicToneMapping;
                    renderer.outputColorSpace = SRGBColorSpace;
                    await renderer.init();
                    return renderer as any;
                }}
                frameloop="demand"
                style={{ touchAction: "none", userSelect: "none" }}
            >
                <Suspense fallback={null}>
                    <GlobePostProcessing>
                        <SceneContent />
                    </GlobePostProcessing>
                </Suspense>
            </Canvas>
        </div>
    );
}
