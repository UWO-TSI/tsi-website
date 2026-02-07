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

const programs = [
  {
    tag: "SIP",
    title: "Summer Internship Program",
    description:
      "Place top student developers inside your engineering team for a 12-week embedded internship. Our students arrive with real project experience, strong collaboration skills, and the technical depth to contribute from week one.",
    features: [
      "Pre-vetted candidates with portfolio projects",
      "Structured mentorship framework included",
      "Flexible start dates (May–September)",
      "Post-program hiring pipeline",
    ],
  },
  {
    tag: "BOUNTY",
    title: "Bounty Program",
    description:
      "Scope a project. Set a budget. Our teams deliver. The Bounty Program gives you access to experienced student teams for well-defined, paid engagements — from MVPs to internal tools to design sprints.",
    features: [
      "Fixed-scope, fixed-price engagements",
      "Dedicated project manager",
      "Weekly progress reports",
      "Full IP transfer on completion",
    ],
  },
];

export default function ProgramsSection() {
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
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
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
      style={{ background: "var(--color-bg-alt)" }}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          ref={titleRef}
          className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16"
          style={{ opacity: 0 }}
        >
          Our Programs
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {programs.map((program, i) => (
            <div
              key={program.tag}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="rounded-2xl border p-8 flex flex-col"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--glass-border-soft)",
                opacity: 0,
              }}
            >
              <span
                className="font-mono text-xs font-bold tracking-widest uppercase mb-4 inline-block"
                style={{ color: "var(--color-brand-blue)" }}
              >
                {program.tag}
              </span>
              <h3 className="font-heading text-2xl font-semibold mb-4">
                {program.title}
              </h3>
              <p
                className="text-sm leading-relaxed mb-6"
                style={{ color: "var(--color-text-muted)" }}
              >
                {program.description}
              </p>
              <ul className="space-y-2 mt-auto">
                {program.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: "var(--color-text-soft)" }}
                  >
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "var(--color-brand-blue)" }}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
