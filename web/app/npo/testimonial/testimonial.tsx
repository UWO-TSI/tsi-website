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
      "Working with Tethos transformed how we serve our community. They didn't just build software — they took the time to understand our mission and deliver something we could actually sustain.",
    author: "Maria Chen",
    role: "Executive Director",
    org: "BrightAid Foundation",
  },
  {
    quote:
      "I've worked with agencies that cost ten times as much and delivered half as much. These students are serious professionals. The handoff was impeccable — our staff was trained and ready on day one.",
    author: "James Okafor",
    role: "Operations Lead",
    org: "ShelterNet",
  },
];

export default function Testimonial({ quotes = defaultQuotes }: TestimonialProps) {
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
      data-navbar-theme="dark"
      className="py-32 px-6"
      style={{ background: "var(--color-bg-alt)" }}
    >
      <div className="max-w-5xl mx-auto">
        <p
          ref={labelRef}
          className="text-center text-xs tracking-[0.3em] mb-4"
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            color: "var(--color-text-subtle)",
            opacity: 0,
          }}
        >
          What Partners Say
        </p>
        <h2
          ref={headingRef}
          className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16"
          style={{ opacity: 0 }}
        >
          The Impact, In Their Words.
        </h2>

        <div className="grid md:grid-cols-2 gap-10">
          {quotes.map((q, i) => (
            <div
              key={i}
              ref={(el) => { quotesRef.current[i] = el; }}
              className="flex flex-col gap-6"
              style={{ opacity: 0 }}
            >
              <blockquote
                className="font-heading text-xl md:text-2xl leading-snug"
                style={{ color: "var(--color-text-primary)" }}
              >
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <footer>
                <p
                  className="text-sm font-medium"
                  style={{
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {q.author}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "var(--color-text-subtle)",
                  }}
                >
                  {q.role} · {q.org}
                </p>
              </footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
