"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_SMOOTH, DURATION_CINEMATIC } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface DocumentaryEmbedProps {
  /** YouTube or Vimeo embed URL */
  embedUrl?: string;
  title?: string;
  subtitle?: string;
}

export default function DocumentaryEmbed({
  embedUrl,
  title = "See Our Impact in Action",
  subtitle = "A short documentary showcasing the real-world outcomes of our nonprofit partnerships.",
}: DocumentaryEmbedProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, scale: 0.92 },
        {
          opacity: 1,
          scale: 1,
          duration: DURATION_CINEMATIC,
          ease: EASE_SMOOTH,
          scrollTrigger: {
            trigger: contentRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-32 px-6"
      style={{ background: "var(--color-bg-alt)" }}
    >
      <div ref={contentRef} className="max-w-4xl mx-auto" style={{ opacity: 0 }}>
        <p
          className="text-center mb-3 text-xs tracking-[0.3em]"
          style={{ fontFamily: "IBM Plex Mono, monospace", color: "var(--color-text-subtle)" }}
        >
          The Work
        </p>
        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-4">
          {title}
        </h2>
        <p
          className="text-center mb-12 max-w-2xl mx-auto"
          style={{ color: "var(--color-text-muted)" }}
        >
          {subtitle}
        </p>

        {/* Video embed */}
        <div className="relative w-full rounded-2xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Tethos Documentary"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center px-8"
              style={{ background: "var(--color-surface)" }}
            >
              <p
                className="font-heading text-2xl text-center leading-snug"
                style={{ color: "var(--color-text-soft)" }}
              >
                Coming 2026 — A short documentary on what it means to build for social good.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
