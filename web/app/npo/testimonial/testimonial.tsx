"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { EASE_ENTER, DURATION_SECTION, STAGGER_NORMAL } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type Quote = {
  quote: string;
  author: string;
  role: string;
  org: string;
};

export type TestimonialProps = {
  quotes?: Quote[];
};

const defaultQuotes: Quote[] = [
  {
    quote:
      "Working with Tethos transformed how we serve our community. They didn't just build software \u2014 they took the time to understand our mission and deliver something we could actually sustain.",
    author: "Maria Chen",
    role: "Executive Director",
    org: "BrightAid Foundation",
  },
  {
    quote:
      "I've worked with agencies that cost ten times as much and delivered half as much. These students are serious professionals. The handoff was impeccable \u2014 our staff was trained and ready on day one.",
    author: "James Okafor",
    role: "Operations Lead",
    org: "ShelterNet",
  },
  {
    quote:
      "What impressed me most was the discovery process. They asked questions our own team hadn't thought of. The final product wasn't just functional \u2014 it genuinely changed how we operate.",
    author: "Priya Sharma",
    role: "Program Manager",
    org: "Canadian Red Cross \u2014 London Chapter",
  },
  {
    quote:
      "Our donor management system went from spreadsheets to a real platform in under five months. The volunteers love using it, and our reporting accuracy went from 60% to 98%.",
    author: "David Mensah",
    role: "Director of Development",
    org: "Childcan",
  },
];

export default function Testimonial({
  quotes = defaultQuotes,
}: TestimonialProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const quotesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        [labelRef.current, headingRef.current],
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          stagger: STAGGER_NORMAL,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );

      quotesRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            delay: i * STAGGER_NORMAL,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
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
      data-navbar-theme="light"
      className="py-32 px-6"
      style={{ background: "#F5FAFF" }}
    >
      <div className="max-w-5xl mx-auto">
        <p
          ref={labelRef}
          className="text-center text-xs tracking-[0.3em] uppercase mb-4"
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            color: "#6B7280",
            opacity: 0,
          }}
        >
          What Partners Say
        </p>
        <h2
          ref={headingRef}
          className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16"
          style={{ color: "#0F0F10", opacity: 0 }}
        >
          The Impact, In Their Words.
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {quotes.map((q, i) => (
            <div
              key={i}
              ref={(el) => {
                quotesRef.current[i] = el;
              }}
              className="relative rounded-2xl p-8 flex flex-col gap-5"
              style={{
                opacity: 0,
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {/* Quote mark accent */}
              <div
                className="absolute top-6 left-6 font-heading text-6xl leading-none select-none"
                style={{ color: "rgba(0,47,167,0.08)" }}
              >
                &ldquo;
              </div>

              <blockquote
                className="font-heading text-lg md:text-xl leading-relaxed relative z-10 pt-4"
                style={{ color: "#1F2937" }}
              >
                &ldquo;{q.quote}&rdquo;
              </blockquote>

              <footer className="mt-auto pt-4 border-t border-black/5">
                <p
                  className="text-sm font-medium"
                  style={{ color: "#0F0F10" }}
                >
                  {q.author}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "#6B7280",
                  }}
                >
                  {q.role} &middot; {q.org}
                </p>
              </footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
