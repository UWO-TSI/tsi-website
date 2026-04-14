"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import GradientText from "@/components/ui/GradientText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NPOApplySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(contentRef.current, { opacity: 1 });
        gsap.set(lineRef.current, { scaleX: 1 });
        return;
      }

      gsap.fromTo(
        lineRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.2,
          ease: "power3.inOut",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
        }
      );

      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
          delay: 0.2,
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="npo-apply"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-32 md:py-44 px-8 md:px-20 lg:px-28 overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      {/* Gradient blend */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{ height: "200px", background: "linear-gradient(to bottom, #0F0F10, #0a0a0b)" }}
      />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: "800px",
          height: "500px",
          background: "radial-gradient(ellipse, rgba(29,155,240,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-[700px] mx-auto text-center">
        {/* Divider */}
        <div className="flex justify-center mb-16">
          <div
            ref={lineRef}
            className="origin-center"
            style={{
              width: "120px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.4), transparent)",
              transform: "scaleX(0)",
            }}
          />
        </div>

        <div ref={contentRef} style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "#1d9bf0", fontFamily: "var(--font-highlight)" }}
          >
            2026 Cohort
          </p>

          <h2
            className="tracking-tight mb-6"
            style={{
              fontFamily: '"Test Sohne", sans-serif',
              fontSize: "clamp(32px, 4.5vw, 56px)",
              fontWeight: 500,
              color: "#F1FFFF",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Ready to{" "}
            <GradientText colors={["#1d9bf0", "#60c5ff", "#1d9bf0"]} animationSpeed={6}>
              build?
            </GradientText>
          </h2>

          <p
            className="text-base md:text-lg leading-relaxed mb-6 mx-auto"
            style={{
              color: "rgba(255,255,255,0.4)",
              fontFamily: '"Test Sohne", sans-serif',
              maxWidth: "480px",
            }}
          >
            Applications for the 2026 cohort are now open.
            Tell us about your organization and the problem you want solved.
          </p>

          <p
            className="text-xs mb-12"
            style={{ color: "rgba(29,155,240,0.7)", fontFamily: "var(--font-highlight)" }}
          >
            Limited to 6 organizations per cohort · Applications close June 2026
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:team@tethos.ca?subject=NPO%20Application%20-%202026%20Cohort"
              className="inline-flex items-center px-8 py-4 rounded-lg text-sm font-semibold transition-all duration-300 hover:shadow-lg"
              style={{
                background: "#1d9bf0",
                color: "#fff",
                fontFamily: '"Test Sohne", sans-serif',
                boxShadow: "0 0 0 rgba(29,155,240,0)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 30px rgba(29,155,240,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 rgba(29,155,240,0)";
              }}
            >
              Apply Now
            </a>
            <Link
              href="/"
              className="inline-flex items-center px-8 py-4 rounded-lg text-sm font-medium transition-all duration-300"
              style={{
                color: "rgba(255,255,255,0.55)",
                fontFamily: '"Test Sohne", sans-serif',
              }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
