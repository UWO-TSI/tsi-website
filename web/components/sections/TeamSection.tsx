"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function TeamSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(imageRef.current, { opacity: 1 });
        gsap.set(captionRef.current, { opacity: 1 });
        return;
      }

      gsap.fromTo(
        imageRef.current,
        { opacity: 0, scale: 1.05 },
        {
          opacity: 1,
          scale: 1,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
        }
      );

      gsap.fromTo(
        captionRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 60%", once: true },
          delay: 0.3,
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="team"
      ref={sectionRef}
      data-navbar-theme="dark"
      className="relative overflow-hidden"
      style={{ background: "#0a0a0b" }}
    >
      {/* Full-bleed team photo */}
      <div
        ref={imageRef}
        className="relative w-full"
        style={{ height: "100vh", minHeight: 500, maxHeight: 900, opacity: 0 }}
      >
        <Image
          src="/images/TeamPhoto.webp"
          alt="Tethos Student Initiative team"
          fill
          className="object-cover"
          sizes="100vw"
          priority={false}
        />
        {/* Top fade */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{ height: "20%", background: "linear-gradient(to bottom, #0a0a0b, transparent)" }}
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: "40%", background: "linear-gradient(to top, #0a0a0b, transparent)" }}
        />
        {/* Text overlay at bottom */}
        <div
          ref={captionRef}
          className="absolute bottom-0 left-0 right-0 px-6 md:px-12 lg:px-20 pb-12 md:pb-16"
          style={{ opacity: 0 }}
        >
          <div className="max-w-[1400px] mx-auto">
            <span
              className="font-mono text-xs tracking-widest uppercase block mb-3"
              style={{ color: "rgba(29,155,240,0.7)" }}
            >
              Our team
            </span>
            <h2
              className="leading-[1.1] tracking-tight"
              style={{
                fontFamily: '"Test Sohne", sans-serif',
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 500,
                color: "#F1FFFF",
              }}
            >
              100+ student developers across 2 chapters.
            </h2>
            <p
              className="mt-3 text-sm md:text-base max-w-xl"
              style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-highlight)" }}
            >
              Western University &middot; University of British Columbia
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
