"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { Color, DirectionalLight, DoubleSide, Material, Mesh, Points, Vector3 } from "three";
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

// ═══════════════════════════════════════════
// Config — values from demo screenshot
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

// ═══════════════════════════════════════════
// Point Material — 1:1 from GlobeAnimated.tsx
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

    // Animated Position
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

    // Motion Delay
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

    // Fade
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

    // Color
    const landLow = landColor
        .mul(float(1.0).sub(blendFactor))
        .add(waterColor.mul(blendFactor));
    const landElevated = landLow.add(landColor.sub(landLow).mul(elevation));
    const color = land.equal(1.0).select(landElevated, waterColor).mul(fade);

    // Material
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
// Globe — 1:1 from GlobeAnimated.tsx
// ═══════════════════════════════════════════

function Globe() {
    const { nodes } = useGLTF("/globe.glb");

    const pointsRef = useRef<Points | null>(null);
    const uniformsRef = useRef<MaterialUniforms | null>(null);
    const previousCameraPosition = useRef(new Vector3());
    const smoothedCameraDelta = useRef(new Vector3());
    const cameraDeltaVec = new Vector3();

    useEffect(() => {
        const geometry = (nodes.GlobePoints as Points).geometry;
        const { material, uniforms } = pointMaterial(1.0);

        uniformsRef.current = uniforms;
        pointsRef.current!.geometry = geometry;
        pointsRef.current!.material = material as unknown as Material;

        // Set config values
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
            <points ref={pointsRef} rotation={[0, 3.45, 0]} />
            <mesh geometry={(nodes.GlobeSphere as Mesh).geometry}>
                <meshStandardMaterial
                    color={CONFIG.water}
                    opacity={CONFIG.opacity}
                    side={DoubleSide}
                    transparent
                />
            </mesh>
        </>
    );
}

// ═══════════════════════════════════════════
// Post Processing — 1:1 from GlobePostProcessing.tsx
// ═══════════════════════════════════════════

function GlobePostProcessing({ children }: { children: ReactNode }) {
    const { camera, gl, scene } = useThree();
    const postProcessing = useRef<PostProcessing | null>(null);
    const bloomPass = useRef<any>(null);

    useEffect(() => {
        if (!gl) return;

        const _postProcessing = new PostProcessing(
            gl as unknown as any
        );

        const _scenePass = pass(scene, camera);
        const _sceneOutput = _scenePass.getTextureNode("output");
        const _bloomPass = bloom(_sceneOutput);

        _bloomPass.radius.value = CONFIG.glow.radius;
        _bloomPass.strength.value = CONFIG.glow.strength;
        _bloomPass.threshold.value = CONFIG.glow.threshold;

        _postProcessing.outputNode = _sceneOutput.add(_bloomPass);

        postProcessing.current = _postProcessing;
        bloomPass.current = _bloomPass;

        return () => {
            _postProcessing.dispose?.();
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
// Scene — 1:1 from Scene.tsx
// ═══════════════════════════════════════════

function SceneContent() {
    const { camera, gl, invalidate, scene } = useThree();
    const lightRef = useRef<DirectionalLight | null>(null);
    const colorRef = useRef(new Color(CONFIG.background));

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
        colorRef.current.set(CONFIG.background);
        scene.background = colorRef.current;
    }, [scene]);

    useEffect(() => {
        if (!lightRef.current) return;
        lightRef.current.color.set(CONFIG.light.color);
    }, []);

    useEffect(() => {
        if (!lightRef.current) return;
        lightRef.current.intensity = CONFIG.light.intensity;
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
                autoRotate
                autoRotateSpeed={0.3}
                dampingFactor={0.03}
                enablePan={false}
                zoomSpeed={0.3}
            />
        </>
    );
}

// ═══════════════════════════════════════════
// Main — Canvas with WebGPU renderer
// ═══════════════════════════════════════════

export default function GlobeTest() {
    return (
        <div style={{ width: "100vw", height: "100vh", background: CONFIG.background }}>
            <Canvas
                camera={{ position: [0, 1, 5.1], fov: 30 }}
                gl={async (props: any) => {
                    const renderer = new WebGPURenderer(props as never);
                    renderer.toneMapping = ACESFilmicToneMapping;
                    renderer.outputColorSpace = SRGBColorSpace;
                    await renderer.init();
                    return renderer as any;
                }}
                frameloop="demand"
                style={{ touchAction: "none", userSelect: "none" }}
                onContextMenu={(e) => e.preventDefault()}
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
