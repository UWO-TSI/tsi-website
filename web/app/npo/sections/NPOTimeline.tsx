"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiDivider from "@/components/ascii/AsciiDivider";
import {
  EASE_ENTER,
  DURATION_SECTION,
  STAGGER_SLOW,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const timelineSteps = [
  {
    phase: "01",
    title: "Application",
    duration: "2 weeks",
    description:
      "Nonprofits submit an application describing their mission, technical needs, and goals. Our team reviews and selects projects based on impact potential and feasibility.",
  },
  {
    phase: "02",
    title: "Discovery",
    duration: "3 weeks",
    description:
      "We meet with your team to understand workflows, pain points, and stakeholders. Research and requirements gathering produce a clear project brief.",
  },
  {
    phase: "03",
    title: "Design",
    duration: "4 weeks",
    description:
      "Our designers create wireframes, user flows, and a visual prototype. You review and iterate until the solution feels right for your organization.",
  },
  {
    phase: "04",
    title: "Development",
    duration: "16 weeks",
    description:
      "Engineering teams build the product in sprints with regular check-ins. You see working software early and often, with opportunities to steer direction.",
  },
  {
    phase: "05",
    title: "Handoff",
    duration: "3 weeks",
    description:
      "We deliver documentation, training, and source code. Your team receives a production-ready product and the knowledge to maintain it.",
  },
];

export default function NPOTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title reveal
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

      // Animate vertical line growing
      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 60%",
              end: "bottom 40%",
              scrub: 1,
            },
          }
        );
      }

      // Each step reveals on scroll
      stepsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, x: i % 2 === 0 ? -30 : 30 },
          {
            opacity: 1,
            x: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: el,
              start: "top 80%",
              toggleActions: "play none none none",
            },
            delay: i * 0.08,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <AsciiDivider rows={2} cols={50} color="var(--color-text-subtle)" />
      <section
        ref={sectionRef}
        className="py-32 px-6"
        style={{ background: "var(--color-bg-alt)" }}
      >
        <div className="max-w-4xl mx-auto">
          <h2
            ref={titleRef}
            className="font-heading text-3xl md:text-4xl font-semibold text-center mb-20"
            style={{ opacity: 0 }}
          >
            Our Process
          </h2>

          {/* Vertical timeline */}
          <div className="relative">
            {/* Center line */}
            <div
              ref={lineRef}
              className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px origin-top"
              style={{ background: "var(--color-text-subtle)", opacity: 0.3 }}
            />

            <div className="space-y-16">
              {timelineSteps.map((step, i) => (
                <div
                  key={step.phase}
                  ref={(el) => { stepsRef.current[i] = el; }}
                  className={`relative flex items-start gap-8 ${
                    i % 2 === 0
                      ? "md:flex-row"
                      : "md:flex-row-reverse md:text-right"
                  }`}
                  style={{ opacity: 0 }}
                >
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span
                        className="font-mono text-xs"
                        style={{ color: "var(--color-brand-blue)" }}
                      >
                        {step.phase}
                      </span>
                      <h3 className="font-heading text-xl font-semibold">
                        {step.title}
                      </h3>
                    </div>
                    <p
                      className="text-xs uppercase tracking-widest mb-3"
                      style={{ color: "var(--color-text-subtle)" }}
                    >
                      {step.duration}
                    </p>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {step.description}
                    </p>
                  </div>

                  {/* Center dot */}
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 bg-[var(--color-bg-alt)]"
                    style={{ borderColor: "var(--color-brand-blue)", top: "4px" }}
                  />

                  {/* Spacer for opposite side */}
                  <div className="hidden md:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
