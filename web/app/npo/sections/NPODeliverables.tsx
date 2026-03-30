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

const deliverables = [
  {
    num: "01",
    title: "Production-Ready Software",
    description:
      "A fully functional application deployed and ready for your organization to use from day one.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="12" rx="2" />
        <path d="M6 16h8M10 15v1" />
        <path d="M6 8l2 2-2 2M10 10h4" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Source Code & Documentation",
    description:
      "Complete access to the codebase with technical documentation so your team or future developers can maintain and extend the product.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h12M4 8h8M4 12h10M4 16h6" />
        <path d="M15 13l3 3-3 3" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Design Assets",
    description:
      "Figma files, brand guidelines integration, and all visual assets used in the project.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="3" />
        <circle cx="13" cy="7" r="3" />
        <circle cx="7" cy="13" r="3" />
        <path d="M13 10a3 3 0 010 6" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Training & Onboarding",
    description:
      "Hands-on training sessions for your staff, plus recorded walkthroughs for future reference.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2a6 6 0 016 6c0 3.5-6 10-6 10S4 11.5 4 8a6 6 0 016-6z" />
        <circle cx="10" cy="8" r="2" />
      </svg>
    ),
  },
  {
    num: "05",
    title: "30-Day Support Window",
    description:
      "Post-handoff bug fixes and support to ensure a smooth transition to your team.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6v4l3 2" />
      </svg>
    ),
  },
  {
    num: "06",
    title: "Impact Report",
    description:
      "A summary of the project outcomes, metrics, and recommendations for future development.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 16L7 10l4 4 3-5 3 3" />
        <rect x="2" y="2" width="16" height="16" rx="2" />
      </svg>
    ),
  },
];

export default function NPODeliverables() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );

      cardsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 25 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
            delay: i * STAGGER_NORMAL,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-32 px-6"
      style={{ background: "var(--color-bg-main)" }}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          ref={titleRef}
          className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16"
          style={{ opacity: 0 }}
        >
          What You Receive
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {deliverables.map((item, i) => (
            <div
              key={item.title}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="rounded-2xl border p-8 transition-all duration-300 hover:border-[var(--color-brand-blue)]/30"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--glass-border-soft)",
                opacity: 0,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 24px rgba(0,47,167,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "";
              }}
            >
              <p
                className="text-xs mb-3"
                style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  color: "var(--color-text-subtle)",
                  letterSpacing: "0.1em",
                }}
              >
                {item.num}
              </p>
              <div className="mb-3" style={{ color: "var(--color-text-muted)" }}>
                {item.icon}
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">
                {item.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-text-muted)" }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
