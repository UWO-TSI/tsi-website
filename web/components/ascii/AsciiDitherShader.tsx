"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ============================================
// ASCII/Dither Post-Processing Shader
// ============================================

const ASCII_CHARS = " .:-=+*#%@";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform float uIntensity;    // 0 = normal, 1 = full ASCII
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uCellSize;     // Size of each ASCII cell in pixels
  varying vec2 vUv;

  // Simple hash for pseudo-random
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Cell grid
    vec2 cellCount = uResolution / uCellSize;
    vec2 cell = floor(vUv * cellCount);
    vec2 cellUv = cell / cellCount;

    // Sample the scene at cell center
    vec4 sceneColor = texture2D(tDiffuse, cellUv);

    // Calculate luminance
    float luma = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));

    // Dither pattern (Bayer-like)
    vec2 cellPos = fract(vUv * cellCount);
    float dither = step(0.5, fract(cellPos.x * 4.0 + cellPos.y * 2.0 + uTime * 0.5));

    // Quantize luminance based on dither
    float threshold = mix(luma, step(0.5, luma + (dither - 0.5) * 0.3), uIntensity);

    // Mix between original and dithered
    vec3 ditherColor = vec3(threshold);
    vec3 finalColor = mix(sceneColor.rgb, ditherColor, uIntensity);

    // Add subtle noise at high intensity for texture
    float noise = hash(cell + uTime) * 0.05 * uIntensity;
    finalColor += noise;

    gl_FragColor = vec4(finalColor, sceneColor.a);
  }
`;

interface DitherPassProps {
  intensity?: number; // 0-1, how much dithering to apply
  cellSize?: number;
}

function DitherPass({ intensity = 0, cellSize = 4 }: DitherPassProps) {
  const { gl, scene, camera, size } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const renderTarget = useMemo(
    () =>
      new THREE.WebGLRenderTarget(size.width, size.height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
    [size.width, size.height]
  );

  const quadScene = useMemo(() => new THREE.Scene(), []);
  const quadCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    []
  );

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          uIntensity: { value: 0 },
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(size.width, size.height) },
          uCellSize: { value: cellSize },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
      }),
    [cellSize, size.width, size.height]
  );

  useEffect(() => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMaterial);
    quadScene.add(quad);
    materialRef.current = shaderMaterial;

    return () => {
      quadScene.remove(quad);
      quad.geometry.dispose();
      shaderMaterial.dispose();
      renderTarget.dispose();
    };
  }, [quadScene, shaderMaterial, renderTarget]);

  useFrame((state) => {
    if (!materialRef.current) return;

    // Render the scene to the offscreen target
    gl.setRenderTarget(renderTarget);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // Update uniforms
    materialRef.current.uniforms.tDiffuse.value = renderTarget.texture;
    materialRef.current.uniforms.uIntensity.value = intensity;
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();

    // Render the post-processed quad
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
}

interface AsciiDitherShaderProps {
  /** Intensity 0-1. 0 = no effect, 1 = full dither */
  intensity?: number;
  /** Pixel size of each dither cell */
  cellSize?: number;
  /** Children (Three.js scene content) */
  children?: React.ReactNode;
  /** CSS className for the canvas wrapper */
  className?: string;
  /** Style for the canvas wrapper */
  style?: React.CSSProperties;
}

/**
 * WebGL post-processing component that applies an ASCII/dither effect
 * to its Three.js children. Used for hero transitions and cinematic moments.
 *
 * Usage:
 * <AsciiDitherShader intensity={scrollProgress}>
 *   <mesh>...</mesh>
 * </AsciiDitherShader>
 */
export default function AsciiDitherShader({
  intensity = 0,
  cellSize = 4,
  children,
  className = "",
  style,
}: AsciiDitherShaderProps) {
  return (
    <div className={className} style={style}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        {children}
        <DitherPass intensity={intensity} cellSize={cellSize} />
      </Canvas>
    </div>
  );
}
