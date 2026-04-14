"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_ENTER, DURATION_SECTION, STAGGER_NORMAL } from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const projects = [
  {
    name: "Donor Nexus",
    client: "BrightAid Foundation",
    type: "Web Platform",
    description:
      "Donor management platform connecting nonprofits with recurring donors. Real-time dashboards, automated tax receipts, and campaign analytics.",
    tech: ["Next.js", "Supabase", "Stripe", "React Email"],
    metric: "3x donor retention",
  },
  {
    name: "HeartFit",
    client: "ShelterNet",
    type: "Mobile App",
    description:
      "Health tracking app for shelter residents. Medication reminders, appointment scheduling, and case worker coordination.",
    tech: ["React Native", "Node.js", "PostgreSQL"],
    metric: "400+ active users",
  },
  {
    name: "Harvest Hub",
    client: "FoodBridge",
    type: "Operations Platform",
    description:
      "Food donation logistics platform. Route optimization for pickup trucks, inventory tracking, and volunteer scheduling.",
    tech: ["Next.js", "Mapbox", "Twilio", "Redis"],
    metric: "60% faster distribution",
  },
  {
    name: "Grant Glass",
    client: "Plan Catalyst",
    type: "Data Dashboard",
    description:
      "Grant tracking and reporting dashboard. Automated compliance reports, budget visualization, and milestone tracking for multi-year grants.",
    tech: ["React", "D3.js", "Python", "PostgreSQL"],
    metric: "$2.4M grants tracked",
  },
];

export default function WorkSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
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
            delay: i * STAGGER_NORMAL,
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
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
      className="py-32 px-6 md:px-16"
      style={{ background: "#0F0F10" }}
    >
      <div className="max-w-6xl mx-auto">
        <div ref={headerRef} className="mb-16" style={{ opacity: 0 }}>
          <p
            className="text-xs tracking-[0.3em] uppercase mb-4"
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              color: "#6B7280",
            }}
          >
            Selected Work
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-semibold text-[#F1FFFF] mb-4">
            Projects That Ship
          </h2>
          <p className="text-[#9CA3AF] max-w-xl">
            Real software built for real organizations. Each project goes
            through our full 8-month delivery cycle.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {projects.map((project, i) => (
            <div
              key={project.name}
              ref={(el) => {
                cardsRef.current[i] = el;
              }}
              className="rounded-2xl p-7 md:p-8 flex flex-col transition-all duration-300 hover:border-white/12"
              style={{
                opacity: 0,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#F1FFFF] mb-1">
                    {project.name}
                  </h3>
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "#6B7280",
                    }}
                  >
                    {project.client} &middot; {project.type}
                  </p>
                </div>
                {/* Metric badge */}
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-mono"
                  style={{
                    background: "rgba(0,47,167,0.1)",
                    color: "#002FA7",
                    border: "1px solid rgba(0,47,167,0.2)",
                  }}
                >
                  {project.metric}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6 flex-1">
                {project.description}
              </p>

              {/* Tech stack */}
              <div className="flex flex-wrap gap-2">
                {project.tech.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-md text-[10px] font-mono"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "#6B7280",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
