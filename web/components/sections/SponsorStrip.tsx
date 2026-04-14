"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LogoLoop from "@/components/ui/LogoLoop";
import { SPONSOR_LOGOS, NPO_LOGOS } from "@/components/ui/PartnerLogos";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}


export default function SponsorStrip() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lineTopRef = useRef<HTMLDivElement>(null);
  const lineBotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([lineTopRef.current, lineBotRef.current], { scaleX: 1 });
        gsap.set(contentRef.current, { opacity: 1 });
        return;
      }

      gsap.fromTo(
        lineTopRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.2,
          ease: "power3.inOut",
          scrollTrigger: { trigger: sectionRef.current, start: "top 80%", once: true },
        }
      );

      gsap.fromTo(
        contentRef.current,
        { opacity: 0, scale: 0.95 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 75%", once: true },
          delay: 0.2,
        }
      );

      gsap.fromTo(
        lineBotRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.2,
          ease: "power3.inOut",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
          delay: 0.4,
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="partners"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "#0F0F10" }}
    >
      {/* Top divider */}
      <div className="max-w-[1400px] mx-auto px-8 md:px-20 lg:px-28 mb-16">
        <div
          ref={lineTopRef}
          className="origin-center"
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)",
            transform: "scaleX(0)",
          }}
        />
      </div>

      <div ref={contentRef} style={{ opacity: 0 }}>
        <h3
          className="text-center text-2xl md:text-3xl font-semibold tracking-tight mb-16"
          style={{ color: "#F1FFFF", fontFamily: '"Test Sohne", sans-serif' }}
        >
          Building for organizations that matter
        </h3>

        {/* Supported by */}
        <div className="mb-14">
          <p
            className="text-center text-xs font-medium uppercase tracking-widest mb-6"
            style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}
          >
            Supported by
          </p>
          <LogoLoop
            logos={SPONSOR_LOGOS}
            speed={60}
            gap={100}
            logoHeight={28}
            fadeOut
            fadeOutColor="#0F0F10"
            pauseOnHover
          />
        </div>

        {/* NPO partners */}
        <div>
          <p
            className="text-center text-xs font-medium uppercase tracking-widest mb-6"
            style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-highlight)" }}
          >
            Organizations we&apos;ve built for
          </p>
          <LogoLoop
            logos={NPO_LOGOS}
            speed={70}
            gap={70}
            logoHeight={28}
            fadeOut
            fadeOutColor="#0F0F10"
            pauseOnHover
          />
        </div>
      </div>

      {/* Bottom divider */}
      <div className="max-w-[1400px] mx-auto px-8 md:px-20 lg:px-28 mt-16">
        <div
          ref={lineBotRef}
          className="origin-center"
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)",
            transform: "scaleX(0)",
          }}
        />
      </div>
    </section>
  );
}
