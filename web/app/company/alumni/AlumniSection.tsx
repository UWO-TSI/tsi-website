"use client";

import { useEffect, useRef } from "react";
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

const placements = [
  { company: "Google", role: "Software Engineer" },
  { company: "Microsoft", role: "Full-Stack Developer" },
  { company: "Amazon", role: "Front-End Engineer" },
  { company: "Stripe", role: "Product Designer" },
  { company: "Shopify", role: "Software Developer" },
  { company: "Meta", role: "Data Engineer" },
  { company: "Figma", role: "Design Engineer" },
  { company: "Notion", role: "Software Engineer" },
];

export default function AlumniSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );

      if (gridRef.current) {
        const items = gridRef.current.children;
        gsap.fromTo(
          items,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            stagger: STAGGER_NORMAL,
            scrollTrigger: {
              trigger: gridRef.current,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-32 px-6"
      style={{ background: "var(--color-bg-main)" }}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          ref={titleRef}
          className="font-heading text-3xl md:text-4xl font-semibold text-center mb-4"
          style={{ opacity: 0 }}
        >
          Where Our Alumni Land
        </h2>
        <p
          className="text-center mb-16 max-w-2xl mx-auto"
          style={{ color: "var(--color-text-muted)" }}
        >
          Tethos alumni go on to work at leading technology companies worldwide.
        </p>

        <div
          ref={gridRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {placements.map((placement) => (
            <div
              key={placement.company}
              className="rounded-xl border p-5 text-center transition-colors duration-300 hover:border-[var(--color-brand-blue)]/30"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--glass-border-soft)",
              }}
            >
              <p className="font-heading text-lg font-semibold mb-1">
                {placement.company}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {placement.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
