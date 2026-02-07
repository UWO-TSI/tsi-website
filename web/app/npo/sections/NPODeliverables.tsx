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
    title: "Production-Ready Software",
    description:
      "A fully functional application deployed and ready for your organization to use from day one.",
  },
  {
    title: "Source Code & Documentation",
    description:
      "Complete access to the codebase with technical documentation so your team or future developers can maintain and extend the product.",
  },
  {
    title: "Design Assets",
    description:
      "Figma files, brand guidelines integration, and all visual assets used in the project.",
  },
  {
    title: "Training & Onboarding",
    description:
      "Hands-on training sessions for your staff, plus recorded walkthroughs for future reference.",
  },
  {
    title: "30-Day Support Window",
    description:
      "Post-handoff bug fixes and support to ensure a smooth transition to your team.",
  },
  {
    title: "Impact Report",
    description:
      "A summary of the project outcomes, metrics, and recommendations for future development.",
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
              className="rounded-2xl border p-6 transition-colors duration-300 hover:border-[var(--color-brand-blue)]/30"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--glass-border-soft)",
                opacity: 0,
              }}
            >
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
