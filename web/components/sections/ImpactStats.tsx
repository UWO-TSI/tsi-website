"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  EASE_ENTER,
  EASE_SMOOTH,
  DURATION_SECTION,
  DURATION_CINEMATIC,
  STAGGER_SLOW,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface Stat {
  value: number;
  suffix: string;
  label: string;
}

const stats: Stat[] = [
  { value: 20, suffix: "+", label: "Projects Delivered" },
  { value: 150, suffix: "+", label: "Student Developers" },
  { value: 1500, suffix: "+", label: "Community Members" },
  { value: 200, suffix: "K+", label: "In Value Created" },
];

export default function ImpactStats() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statRefs = useRef<(HTMLDivElement | null)[]>([]);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Staggered reveal of stat cards
      statRefs.current.forEach((el, i) => {
        if (!el) return;

        gsap.fromTo(
          el,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
            },
            delay: i * STAGGER_SLOW,
          }
        );
      });

      // Animated counters
      numberRefs.current.forEach((el, i) => {
        if (!el) return;

        const target = stats[i].value;
        const obj = { value: 0 };

        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              value: target,
              duration: DURATION_CINEMATIC,
              ease: EASE_SMOOTH,
              delay: i * STAGGER_SLOW,
              onUpdate: () => {
                if (el) {
                  el.textContent = Math.round(obj.value).toLocaleString();
                }
              },
            });
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-32 px-6"
      style={{ background: "var(--color-bg-alt)" }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              ref={(el) => { statRefs.current[i] = el; }}
              className="text-center"
              style={{ opacity: 0 }}
            >
              <div className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-3">
                <span
                  ref={(el) => { numberRefs.current[i] = el; }}
                  style={{ color: "var(--color-brand-blue)" }}
                >
                  0
                </span>
                <span style={{ color: "var(--color-brand-blue)" }}>
                  {stat.suffix}
                </span>
              </div>
              <p
                className="text-sm md:text-base"
                style={{ color: "var(--color-text-muted)" }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
