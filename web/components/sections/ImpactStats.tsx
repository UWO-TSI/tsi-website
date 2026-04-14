"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
  const suffixRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dividerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(dividerRef.current, { scaleX: 1 });
        gsap.set(headerRef.current, { opacity: 1 });
        statRefs.current.forEach((el) => { if (el) gsap.set(el, { opacity: 1 }); });
        numberRefs.current.forEach((el, i) => {
          if (el) el.textContent = stats[i].value.toLocaleString();
        });
        return;
      }

      // Scroll-driven glow breathing
      if (glowRef.current) {
        gsap.fromTo(
          glowRef.current,
          { opacity: 0.06 },
          {
            opacity: 0.16,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "center center",
              scrub: true,
            },
          }
        );
        gsap.to(glowRef.current, {
          opacity: 0.04,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "center center",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      // Header slides from left
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, x: -30 },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
        }
      );

      // Divider draws in
      gsap.fromTo(
        dividerRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.5,
          ease: "power3.inOut",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
        }
      );

      // Stats clip-path reveal
      statRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, clipPath: "inset(100% 0 0 0)" },
          {
            opacity: 1,
            clipPath: "inset(0% 0 0 0)",
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
            delay: 0.4 + i * 0.12,
          }
        );
      });

      // Scrub-driven counter animation
      const counterTrigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 60%",
        end: "bottom 70%",
        scrub: 0.5,
        onUpdate: (self) => {
          const progress = self.progress;
          numberRefs.current.forEach((el, i) => {
            if (!el) return;
            const current = Math.round(stats[i].value * Math.min(progress * 1.5, 1));
            el.textContent = current.toLocaleString();

            // Scale numbers slightly as they count up
            const scale = 1 + (progress * 0.08);
            el.style.transform = `scale(${Math.min(scale, 1.08)})`;
            el.style.display = "inline-block";
          });
        },
        onLeave: () => {
          // Ensure final values + blue pulse on suffixes
          numberRefs.current.forEach((el, i) => {
            if (el) {
              el.textContent = stats[i].value.toLocaleString();
              el.style.transform = "scale(1)";
            }
          });
          // Blue accent pulse on suffixes
          suffixRefs.current.forEach((el) => {
            if (!el) return;
            gsap.fromTo(
              el,
              { color: "rgba(29,155,240,1)", textShadow: "0 0 20px rgba(29,155,240,0.6)" },
              {
                color: "rgba(29,155,240,0.8)",
                textShadow: "0 0 0px rgba(29,155,240,0)",
                duration: 0.8,
                ease: "power2.out",
              }
            );
          });
        },
      });

      return () => counterTrigger.kill();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="impact"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-28 md:py-36 px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0F0F10" }}
    >
      {/* Scroll-driven ambient glow */}
      <div
        ref={glowRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: "1000px",
          height: "600px",
          background: "radial-gradient(ellipse, rgba(29,155,240,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          opacity: 0.06,
        }}
      />

      <div className="relative max-w-[1400px] mx-auto">
        <div ref={headerRef} style={{ opacity: 0 }}>
          <p
            className="text-sm font-medium tracking-widest uppercase mb-4"
            style={{ color: "rgba(29,155,240,0.7)", fontFamily: "var(--font-highlight)" }}
          >
            Impact
          </p>
          <h2
            className="leading-[1.1] tracking-tight mb-6"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 500,
              color: "#F1FFFF",
            }}
          >
            Numbers that speak.
          </h2>
        </div>

        {/* Animated horizontal line */}
        <div
          ref={dividerRef}
          className="origin-left mb-16"
          style={{
            height: "1px",
            background: "linear-gradient(90deg, rgba(29,155,240,0.5), rgba(255,255,255,0.06) 70%, transparent)",
            transform: "scaleX(0)",
          }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              ref={(el) => { statRefs.current[i] = el; }}
              style={{ opacity: 0 }}
            >
              <div className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-3">
                <span
                  ref={(el) => { numberRefs.current[i] = el; }}
                  className="inline-block origin-left transition-transform"
                  style={{ color: "#F1FFFF" }}
                >
                  0
                </span>
                <span
                  ref={(el) => { suffixRefs.current[i] = el; }}
                  style={{ color: "rgba(29,155,240,0.8)", transition: "color 0.3s, text-shadow 0.3s" }}
                >
                  {stat.suffix}
                </span>
              </div>
              <p
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-highlight)" }}
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
