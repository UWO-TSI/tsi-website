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
  { value: 20, suffix: "+", label: "Projects" },
  { value: 150, suffix: "+", label: "Alumni & Members" },
  { value: 1500, suffix: "+", label: "Community" },
  { value: 200000, suffix: "K+", label: "Value Saved for NPOs", display: 200 },
];

export default function NPOAbout() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLElement | null)[]>([]);
  const statNumRefs = useRef<(HTMLSpanElement | null)[]>([]);

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

      // Animated counters
      const counterValues = [20, 150, 1500, 200];
      statNumRefs.current.forEach((el, i) => {
        if (!el) return;
        const target = counterValues[i];
        gsap.fromTo(
          { val: 0 },
          { val: target },
          {
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
            },
            onUpdate: function () {
              if (el) el.textContent = String(Math.round(this.targets()[0].val));
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
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
              className="font-heading text-2xl mb-6 leading-snug italic"
              style={{ opacity: 0 }}
            >
              &ldquo;We&rsquo;re not a consultancy. We&rsquo;re a collective of students who believe nonprofits deserve the same software as Fortune 500 companies.&rdquo;
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

          {/* Right: photo + stat grid */}
          <div
            ref={(el) => { elementsRef.current[3] = el; }}
            className="flex flex-col gap-8"
            style={{ opacity: 0 }}
          >
            {/* Photo slot */}
            <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <img
                src="/images/npo-about-1.jpg"
                alt="Tethos NPO team"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  const parent = e.currentTarget.parentElement;
                  if (parent) parent.style.background = "var(--color-surface)";
                }}
              />
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-8">
              {stats.map((stat, i) => (
                <div key={stat.label}>
                  <div
                    className="font-heading text-3xl font-bold mb-1 flex items-baseline gap-0.5"
                    style={{ color: "var(--color-brand-blue)" }}
                  >
                    {i === 3 && <span style={{ color: "var(--color-brand-blue)" }}>$</span>}
                    <span ref={(el) => { statNumRefs.current[i] = el; }}>
                      {i === 3 ? "200" : String(stat.value)}
                    </span>
                    <span>{stat.suffix}</span>
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
      </div>
    </section>
  );
}
