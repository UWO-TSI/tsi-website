"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_ENTER, DURATION_SECTION } from "@/lib/motion";

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
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
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
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "var(--color-surface)" }}
            >
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--color-brand-blue)" }}
                >
                  <svg
                    className="w-6 h-6 text-white ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Documentary coming soon
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
