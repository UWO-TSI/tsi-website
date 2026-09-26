"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const stats = [
  { val: 20, suffix: "+", label: "Projects Completed", featured: true },
  { val: 150, suffix: "+", label: "Alumni & Members", featured: false },
  { val: 1500, suffix: "+", label: "Community", featured: false },
  { val: 200, suffix: "K+", label: "Value Delivered ($)", featured: false },
  { val: 85, suffix: "%", label: "Alumni Placement Rate", featured: false },
];

export default function NPOStats() {
  const sectionRef = useRef<HTMLElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      // Counter animations
      stats.forEach((s, i) => {
        const numEl = numRefs.current[i];
        if (!numEl) return;
        gsap.fromTo(
          { v: 0 },
          { v: s.val },
          {
            duration: 2.0,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 75%",
              toggleActions: "play none none none",
            },
            onUpdate: function () {
              if (numEl)
                numEl.textContent = String(
                  Math.round(this.targets()[0].v)
                );
            },
          }
        );
      });

      // Stagger reveal cells
      gsap.fromTo(
        el.querySelectorAll(".stat-cell"),
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1.2,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: {
            trigger: el,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      style={{
        background: "#0F0F10",
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 64 }}>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#5A5650",
              display: "block",
              marginBottom: 20,
            }}
          >
            By The Numbers
          </span>
        </div>

        <div
          className="stat-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
            gap: 2,
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="stat-cell"
              style={{
                opacity: 0,
                background: "#1A1714",
                padding:
                  i === 0
                    ? "clamp(40px, 5vw, 64px)"
                    : "clamp(32px, 4vw, 48px)",
                borderRadius:
                  i === 0
                    ? "6px 0 0 6px"
                    : i === stats.length - 1
                    ? "0 6px 6px 0"
                    : 0,
                display: "flex",
                flexDirection: "column" as const,
                justifyContent: "flex-end",
                minHeight: i === 0 ? 240 : 200,
              }}
            >
              <div
                style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize:
                    i === 0
                      ? "clamp(56px, 7vw, 96px)"
                      : "clamp(36px, 4.5vw, 56px)",
                  fontWeight: 700,
                  color: i === 0 ? "#002FA7" : "#F5F2EB",
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "baseline",
                }}
              >
                <span
                  ref={(el) => {
                    numRefs.current[i] = el;
                  }}
                >
                  {s.val}
                </span>
                <span
                  style={{
                    fontSize: "0.55em",
                    color: i === 0 ? "#002FA7" : "#5A5650",
                  }}
                >
                  {s.suffix}
                </span>
              </div>
              <p
                style={{
                  fontFamily:
                    "var(--font-body), system-ui, sans-serif",
                  fontSize: 13,
                  fontWeight: 300,
                  color: "#5A5650",
                  lineHeight: 1.4,
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "#5A5650",
            marginTop: 32,
            textAlign: "center",
          }}
        >
          Across 3 university chapters since 2022.
        </p>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .stat-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
