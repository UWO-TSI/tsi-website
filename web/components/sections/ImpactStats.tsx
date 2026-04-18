"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STATS = [
  { value: "20+", label: "Deployed solutions" },
  { value: "100+", label: "Student developers" },
  { value: "$300K+", label: "Value created" },
  { value: "2", label: "Active chapters" },
];

export default function ImpactStats() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !statsRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(statsRef.current, { opacity: 1 });
        return;
      }

      const items = statsRef.current!.children;
      gsap.fromTo(
        items,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="impact"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-20 md:py-28 px-6 md:px-12 lg:px-20"
      style={{ background: "#0F0F10" }}
    >
      <div className="max-w-[1400px] mx-auto">
        {/* Divider */}
        <div className="h-px w-full mb-16" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />

        {/* Stats grid */}
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8">
          {STATS.map((stat) => (
            <div key={stat.label} style={{ opacity: 0 }}>
              <div
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
                style={{ color: "#F1FFFF", fontFamily: '"Test Sohne", sans-serif' }}
              >
                {stat.value}
              </div>
              <div
                className="mt-2 text-xs tracking-widest uppercase"
                style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-highlight)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
