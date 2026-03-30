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

// CSS-only artifact mockups for each phase
function TimelineArtifact({ phase }: { phase: string }) {
  if (phase === "01") {
    // Form mockup
    return (
      <div className="hidden md:flex flex-col gap-3 p-5 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--glass-border-soft)", width: 200 }}>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>Organization name</span>
          <div className="h-7 rounded-md border px-2 flex items-center" style={{ borderColor: "var(--glass-border-soft)", background: "var(--color-bg-alt)" }}>
            <div className="h-2 w-24 rounded-sm" style={{ background: "var(--color-text-subtle)", opacity: 0.3 }} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>Mission statement</span>
          <div className="h-7 rounded-md border px-2 flex items-center" style={{ borderColor: "var(--glass-border-soft)", background: "var(--color-bg-alt)" }}>
            <div className="h-2 w-16 rounded-sm" style={{ background: "var(--color-text-subtle)", opacity: 0.3 }} />
          </div>
        </div>
        <button className="mt-1 h-8 rounded-md text-xs font-medium text-white" style={{ background: "#002FA7" }}>
          Submit Application
        </button>
      </div>
    );
  }
  if (phase === "02") {
    // Sticky-note affinity grid
    return (
      <div className="hidden md:grid grid-cols-3 gap-2 p-2" style={{ width: 200 }}>
        {[
          { text: "User flows", rot: "-2deg", bg: "#FDE68A" },
          { text: "Pain points", rot: "1.5deg", bg: "#FCA5A5" },
          { text: "Goals", rot: "-1deg", bg: "#6EE7B7" },
          { text: "Stakeholders", rot: "2deg", bg: "#93C5FD" },
          { text: "Workflows", rot: "-1.5deg", bg: "#FDE68A" },
          { text: "Research", rot: "1deg", bg: "#C4B5FD" },
        ].map((note) => (
          <div
            key={note.text}
            className="h-14 rounded-sm p-1.5 flex items-start text-[9px] font-medium text-[#0F0F10]"
            style={{ background: note.bg, transform: `rotate(${note.rot})`, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
          >
            {note.text}
          </div>
        ))}
      </div>
    );
  }
  if (phase === "03") {
    // Component palette — swatches + navbar silhouette
    return (
      <div className="hidden md:flex flex-col gap-3 p-4 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--glass-border-soft)", width: 200 }}>
        <div className="flex gap-2">
          {["#002FA7", "#0039CC", "#F1FFFF", "#0F0F10", "#A1A1AA"].map((c) => (
            <div key={c} className="w-7 h-7 rounded-full border border-white/10" style={{ background: c }} />
          ))}
        </div>
        <div className="h-px" style={{ background: "var(--glass-border-soft)" }} />
        <div className="rounded-md px-3 py-2 flex items-center justify-between" style={{ background: "var(--color-bg-alt)" }}>
          <div className="h-2 w-10 rounded-sm" style={{ background: "var(--color-text-subtle)", opacity: 0.5 }} />
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-1.5 w-6 rounded-sm" style={{ background: "var(--color-text-subtle)", opacity: 0.3 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (phase === "04") {
    // Code block — terminal-styled
    return (
      <div className="hidden md:block rounded-xl overflow-hidden border" style={{ background: "#0D1117", borderColor: "#30363D", width: 220, fontFamily: "IBM Plex Mono, monospace" }}>
        <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "#30363D", background: "#161B22" }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <pre className="text-[9px] leading-relaxed px-3 py-3" style={{ color: "#C9D1D9" }}>
          <span style={{ color: "#79C0FF" }}>async</span>{" "}
          <span style={{ color: "#D2A8FF" }}>function</span>{" "}
          <span style={{ color: "#FFA657" }}>fetchDonors</span>
          {"() {\n"}
          {"  "}
          <span style={{ color: "#79C0FF" }}>const</span>{" data =\n"}
          {"    "}
          <span style={{ color: "#79C0FF" }}>await</span>{" api\n"}
          {"      .donors()\n"}
          {"      .filter(\n"}
          {"        active: "}
          <span style={{ color: "#79C0FF" }}>true</span>
          {"\n      );\n"}
          {"  "}
          <span style={{ color: "#79C0FF" }}>return</span>{" data;\n}"}
        </pre>
      </div>
    );
  }
  if (phase === "05") {
    // Browser chrome
    return (
      <div className="hidden md:block rounded-xl overflow-hidden border" style={{ background: "var(--color-surface)", borderColor: "var(--glass-border-soft)", width: 220 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--glass-border-soft)", background: "var(--color-bg-alt)" }}>
          <div className="flex gap-1">
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="flex-1 h-4 rounded-sm flex items-center px-2" style={{ background: "var(--color-bg-main)" }}>
            <span className="text-[8px]" style={{ color: "var(--color-text-subtle)" }}>yournonprofit.org</span>
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <div className="h-16 rounded-md" style={{ background: "#002FA7", opacity: 0.8 }} />
          <div className="flex gap-2">
            <div className="h-8 flex-1 rounded-md" style={{ background: "var(--color-bg-alt)" }} />
            <div className="h-8 flex-1 rounded-md" style={{ background: "var(--color-bg-alt)" }} />
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function NPOTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const monoLabelRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);
  const artifactsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Mono label reveal
      gsap.fromTo(
        monoLabelRef.current,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: DURATION_SECTION,
          ease: EASE_ENTER,
          scrollTrigger: {
            trigger: monoLabelRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );

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

      // Each step + artifact reveals on scroll
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

        // Artifact reveal simultaneously
        const artifact = artifactsRef.current[i];
        if (artifact) {
          gsap.fromTo(
            artifact,
            { opacity: 0, scale: 0.96 },
            {
              opacity: 1,
              scale: 1,
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
        }

        // Dot glow on reveal
        const dot = dotsRef.current[i];
        if (dot) {
          gsap.fromTo(
            dot,
            { opacity: 0, scale: 0.5 },
            {
              opacity: 1,
              scale: 1,
              duration: DURATION_SECTION,
              ease: EASE_ENTER,
              scrollTrigger: {
                trigger: el,
                start: "top 80%",
                toggleActions: "play none none none",
                onEnter: () => {
                  gsap.set(dot, { boxShadow: "0 0 8px rgba(0,47,167,0.6)" });
                },
              },
              delay: i * 0.08,
            }
          );
        }
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
          <p
            ref={monoLabelRef}
            className="text-center mb-4"
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "0.75rem",
              letterSpacing: "0.3em",
              color: "var(--color-text-subtle)",
              opacity: 0,
            }}
          >
            Our Process
          </p>
          <h2
            ref={titleRef}
            className="font-heading text-3xl md:text-4xl font-semibold text-center mb-20"
            style={{ opacity: 0 }}
          >
            How We Work Together
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
                    <div className={`flex items-baseline gap-3 mb-2 ${i % 2 !== 0 ? "md:justify-end" : ""}`}>
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
                  <div
                    ref={(el) => { dotsRef.current[i] = el; }}
                    className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-[var(--color-bg-alt)]"
                    style={{ borderColor: "var(--color-brand-blue)", top: "4px", opacity: 0 }}
                  />

                  {/* Artifact on opposite side */}
                  <div
                    className="hidden md:flex flex-1 items-start"
                    style={{ justifyContent: i % 2 === 0 ? "flex-start" : "flex-end" }}
                  >
                    <div
                      ref={(el) => { artifactsRef.current[i] = el; }}
                      style={{ opacity: 0 }}
                    >
                      <TimelineArtifact phase={step.phase} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
