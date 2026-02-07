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

const stats = [
  { value: "20+", label: "Projects" },
  { value: "150+", label: "Alumni & Members" },
  { value: "1,500+", label: "Community" },
  { value: "$200K+", label: "Value Saved for NPOs" },
];

export default function NPOAbout() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      elementsRef.current.forEach((el, i) => {
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
            delay: i * STAGGER_NORMAL,
          }
        );
      });
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
        <div className="grid md:grid-cols-2 gap-16 items-start">
          {/* Left: description */}
          <div>
            <h2
              ref={(el) => { elementsRef.current[0] = el; }}
              className="font-heading text-3xl md:text-4xl font-semibold mb-6"
              style={{ opacity: 0 }}
            >
              Our Nonprofit Program
            </h2>
            <p
              ref={(el) => { elementsRef.current[1] = el; }}
              className="text-lg leading-relaxed mb-4"
              style={{ color: "var(--color-text-soft)", opacity: 0 }}
            >
              Designed specifically for registered nonprofit organizations, our
              program pairs student development teams with nonprofits who need
              modern technology but lack the resources to build it.
            </p>
            <p
              ref={(el) => { elementsRef.current[2] = el; }}
              className="text-base leading-relaxed"
              style={{ color: "var(--color-text-muted)", opacity: 0 }}
            >
              Over 8 months, we handle discovery, design, development, and
              handoff — delivering production-ready software at no cost.
            </p>
          </div>

          {/* Right: stats grid */}
          <div
            ref={(el) => { elementsRef.current[3] = el; }}
            className="grid grid-cols-2 gap-8"
            style={{ opacity: 0 }}
          >
            {stats.map((stat) => (
              <div key={stat.label}>
                <div
                  className="font-heading text-3xl font-bold mb-1"
                  style={{ color: "var(--color-brand-blue)" }}
                >
                  {stat.value}
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
