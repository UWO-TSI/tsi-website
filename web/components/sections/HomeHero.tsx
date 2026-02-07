"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import ScrollIndicator from "@/components/ui/ScrollIndicator";
import {
  EASE_CINEMATIC,
  EASE_ENTER,
  DURATION_SECTION,
  DURATION_CINEMATIC,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================
// Abstract 3D Visual — cursor + scroll reactive
// ============================================

function AbstractVisual() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const mouse = useRef({ x: 0, y: 0 });

  const vertexShader = `
    uniform float uTime;
    uniform float uScroll;
    varying vec2 vUv;
    varying float vElevation;

    // Simplex-style noise approximation
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      float noiseVal = snoise(vec3(pos.x * 1.5, pos.y * 1.5, uTime * 0.15));
      float elevation = noiseVal * 0.35 * (1.0 - uScroll * 0.5);
      pos.z += elevation;
      vElevation = elevation;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uScroll;
    uniform vec2 uMouse;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      // Base colors — brand blue to cyan gradient
      vec3 colorLow = vec3(0.0, 0.184, 0.655);  // #002FA7
      vec3 colorHigh = vec3(0.133, 0.827, 0.933); // #22D3EE

      float mixVal = (vElevation + 0.35) / 0.7;
      vec3 color = mix(colorLow, colorHigh, mixVal);

      // Mouse proximity glow
      float mouseDist = distance(vUv, uMouse);
      float glow = smoothstep(0.4, 0.0, mouseDist) * 0.3;
      color += glow;

      // Fade with scroll
      float alpha = mix(0.6, 0.0, uScroll);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX / window.innerWidth;
      mouse.current.y = 1.0 - e.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    materialRef.current.uniforms.uMouse.value.set(
      mouse.current.x,
      mouse.current.y
    );
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    }),
    []
  );

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 3, 0, 0]} position={[0, -0.3, 0]}>
      <planeGeometry args={[5, 5, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ============================================
// HomeHero — "Nav is the hero" section
// ============================================

export default function HomeHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Content entrance
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          delay: 0.2,
        }
      );

      // Fade out scroll indicator on scroll
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "top+=300 top",
        scrub: true,
        onUpdate: (self) => {
          const opacity = Math.max(0, 1 - self.progress * 2);
          gsap.set(scrollIndicatorRef.current, { opacity });
        },
      });

      // Fade out entire hero on scroll
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=100%",
        scrub: true,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress;
          gsap.set(contentRef.current, { opacity: 1 - self.progress });

          // Update 3D scene scroll uniform
          if (canvasWrapperRef.current) {
            gsap.set(canvasWrapperRef.current, {
              opacity: 1 - self.progress,
            });
          }
        },
      });
    }, sectionRef);

    const refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 100);

    return () => {
      ctx.revert();
      clearTimeout(refreshTimer);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="h-screen flex items-center justify-center relative bg-[#0F0F10] overflow-hidden"
    >
      {/* 3D Background Visual */}
      {mounted && (
        <div
          ref={canvasWrapperRef}
          className="absolute inset-0 z-0"
          style={{ opacity: 1 }}
        >
          <Canvas
            camera={{ position: [0, 0, 2.5], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
          >
            <AbstractVisual />
          </Canvas>
        </div>
      )}

      {/* Content overlay */}
      <div
        ref={contentRef}
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center w-full max-w-5xl"
      >
        <h1 className="font-heading mb-6 text-5xl md:text-6xl lg:text-7xl font-semibold leading-tight tracking-tight">
          Technology That Moves
          <br />
          People Forward.
        </h1>

        <p className="max-w-2xl text-base md:text-lg text-zinc-400 mb-0">
          We build modern software for nonprofits, companies, and communities.
          <br className="hidden md:block" />
          Powered by student developers. Designed for real-world impact.
        </p>
      </div>

      {/* Scroll indicator — bottom center */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
      >
        <ScrollIndicator />
        <span className="text-xs font-light text-[#A1A1AA]">
          Scroll to explore
        </span>
      </div>
    </section>
  );
}
