"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  EASE_ENTER,
  DURATION_SECTION,
  STAGGER_NORMAL,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Dynamic import to avoid SSR issues with Three.js / R3F
const InteractivePylon3D = dynamic(
  () => import("@/components/ui/InteractivePylon3D"),
  { ssr: false }
);

interface UnderConstructionProps {
  title?: string;
  message?: string;
  showHint?: boolean;
}

export default function UnderConstruction({
  title = "Under Construction",
  message = "We're building something great. Check back soon.",
  showHint = true,
}: UnderConstructionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const pylonRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const elements = [
        headingRef.current,
        messageRef.current,
        pylonRef.current,
        ...(showHint && hintRef.current ? [hintRef.current] : []),
      ];

      elements.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "top 50%",
              toggleActions: "play none none none",
            },
            delay: i * STAGGER_NORMAL,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [showHint]);

  return (
    <section
      ref={sectionRef}
      className="min-h-screen flex flex-col items-center justify-center relative py-24 px-6"
      style={{ background: "var(--color-bg-main)" }}
    >
      {/* Heading */}
      <h2
        ref={headingRef}
        className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center mb-4"
        style={{ opacity: 0, color: "var(--color-text-primary)" }}
      >
        {title}
      </h2>

      {/* Subtext */}
      <p
        ref={messageRef}
        className="text-lg md:text-xl text-center max-w-xl mb-12"
        style={{ opacity: 0, color: "var(--color-text-soft)" }}
      >
        {message}
      </p>

      {/* 3D Pylon */}
      <div
        ref={pylonRef}
        className="w-full max-w-2xl h-[400px] md:h-[480px] rounded-2xl overflow-hidden"
        style={{ opacity: 0 }}
      >
        <InteractivePylon3D
          modelPath="/models/pylon.gltf"
          gravity={0.15}
          damping={0.92}
          restoringTorque={0.08}
          impulseStrength={0.003}
          tippingThreshold={45}
          mouseInteractionRadius={150}
          scale={1}
          position={[0, 0, 0]}
        />
      </div>

      {/* Interaction hint */}
      {showHint && (
        <p
          ref={hintRef}
          className="mt-6 text-sm tracking-wide text-center"
          style={{ opacity: 0, color: "var(--color-text-muted)" }}
        >
          Move your mouse near the pylon to interact
        </p>
      )}
    </section>
  );
}
