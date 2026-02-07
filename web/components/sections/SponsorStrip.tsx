"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_ENTER, DURATION_SECTION } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Placeholder logos — replace with real SVGs in /public/logos/.
 * Each entry is { name, src? }. Without `src`, a text placeholder renders.
 */
const logos = [
  { name: "Partner 1" },
  { name: "Partner 2" },
  { name: "Partner 3" },
  { name: "Partner 4" },
  { name: "Partner 5" },
  { name: "Partner 6" },
  { name: "Partner 7" },
  { name: "Partner 8" },
];

export default function SponsorStrip() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Fade in title
      gsap.fromTo(
        titleRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Double the logos for seamless infinite scroll
  const allLogos = [...logos, ...logos];

  return (
    <section
      ref={sectionRef}
      className="py-16 overflow-hidden"
      style={{ background: "var(--color-bg-main)" }}
    >
      {/* Section label */}
      <p
        ref={titleRef}
        className="text-center text-xs font-medium uppercase tracking-widest mb-10"
        style={{ color: "var(--color-text-subtle)", opacity: 0 }}
      >
        Trusted by organizations nationwide
      </p>

      {/* Auto-scrolling strip */}
      <div className="relative">
        <div
          ref={stripRef}
          className="flex gap-16 items-center animate-scroll-strip"
          style={{ width: "max-content" }}
        >
          {allLogos.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex-shrink-0 flex items-center justify-center h-12 px-6 rounded-md transition-opacity duration-300 hover:opacity-100 opacity-40"
            >
              {/* Replace with <Image src={logo.src} /> when real logos are available */}
              <span
                className="font-heading text-sm font-semibold whitespace-nowrap"
                style={{ color: "var(--color-text-muted)" }}
              >
                {logo.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CSS animation for infinite horizontal scroll */}
      <style jsx>{`
        @keyframes scrollStrip {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll-strip {
          animation: scrollStrip 30s linear infinite;
        }
        .animate-scroll-strip:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
