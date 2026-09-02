"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  EASE_ENTER,
  EASE_SMOOTH,
  DURATION_SECTION,
  DURATION_CINEMATIC,
  STAGGER_NORMAL,
  STAGGER_SLOW,
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const phases = [
  {
    num: "01",
    title: "Application",
    duration: "2 weeks",
    desc: "Nonprofits submit a brief describing their mission and technical needs. We evaluate based on impact potential, scope feasibility, and organizational readiness.",
  },
  {
    num: "02",
    title: "Discovery",
    duration: "3 weeks",
    desc: "We embed with your team. Stakeholder interviews, workflow mapping, and requirements gathering produce a single clear project brief that both sides sign off on.",
  },
  {
    num: "03",
    title: "Design",
    duration: "4 weeks",
    desc: "Information architecture, wireframes, and a high-fidelity interactive prototype. You iterate with our designers until the solution feels right.",
  },
  {
    num: "04",
    title: "Development",
    duration: "16 weeks",
    desc: "Sprint-based engineering with biweekly demos. Working software ships early and often. You steer direction at every check-in.",
  },
  {
    num: "05",
    title: "Handoff",
    duration: "3 weeks",
    desc: "Production deployment, staff training, complete documentation, and 30 days of post-launch support. Everything is yours.",
  },
];

const deliverables = [
  { title: "Production-Ready Software", desc: "Deployed, tested, monitored, and ready for your team from day one." },
  { title: "Full Source Code", desc: "Complete repository. Yours to own, modify, and extend forever. No vendor lock-in." },
  { title: "Design System", desc: "Figma source files, component library, and all visual assets used in the project." },
  { title: "Technical Documentation", desc: "Architecture decisions, API docs, and deployment guides any developer can follow." },
  { title: "Staff Training", desc: "Hands-on sessions plus recorded walkthroughs for onboarding future team members." },
  { title: "Impact Report", desc: "Project outcomes, usage metrics, and recommendations for continued development." },
];

const differentiators = [
  { label: "Commitment", value: "8 months, not 8 weeks" },
  { label: "Ownership", value: "You own the code. No vendor lock-in." },
  { label: "Cost", value: "Pro-bono. $0. Fully sponsored." },
  { label: "Team Size", value: "4–6 developers + designer + PM per project" },
];

export default function ProgramPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      if (heroRef.current) {
        const children = heroRef.current.querySelectorAll("[data-reveal]");
        gsap.fromTo(
          children,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            stagger: STAGGER_NORMAL,
            ease: EASE_ENTER,
            delay: 0.2,
          }
        );
      }

      // Section reveals
      sectionsRef.current.forEach((el) => {
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
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      // Stat counters
      const targets = [20, 150, 200, 85];
      numberRefs.current.forEach((el, i) => {
        if (!el) return;
        const obj = { value: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              value: targets[i],
              duration: DURATION_CINEMATIC,
              ease: EASE_SMOOTH,
              delay: i * STAGGER_SLOW,
              onUpdate: () => {
                if (el) el.textContent = Math.round(obj.value).toLocaleString();
              },
            });
          },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <SmoothScroll>
      <main className="min-h-screen" style={{ backgroundColor: "#0F0F10", color: "#F5F5F5" }}>

        {/* HERO */}
        <section
          data-navbar-theme="dark"
          className="min-h-[90vh] flex items-center justify-center px-6 pt-40 pb-24"
        >
          <div ref={heroRef} className="max-w-4xl mx-auto text-center">
            <p
              data-reveal
              className="font-mono text-xs uppercase tracking-[0.3em] mb-8"
              style={{ color: "#555" }}
            >
              The NPO Program
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight"
            >
              From Discovery
              <br />
              <span className="italic font-light" style={{ color: "#888" }}>
                to Deployment.
              </span>
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
              style={{ color: "#888" }}
            >
              An 8-month pro-bono initiative that pairs registered nonprofits
              with dedicated student teams to build production-ready software.
            </p>
            <div data-reveal className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/npo/apply"
                className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
                style={{ backgroundColor: "#002FA7" }}
              >
                Apply for 2026 Cohort
              </a>
              <a
                href="#"
                className="rounded-full px-8 py-4 text-sm font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ border: "1px solid #333", color: "#999" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Package
              </a>
            </div>
          </div>
        </section>

        {/* DIFFERENTIATORS */}
        <section
          data-navbar-theme="dark"
          className="py-24 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[0] = el; }}
            className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-5"
            style={{ opacity: 0 }}
          >
            {differentiators.map((d) => (
              <div
                key={d.label}
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
              >
                <p className="font-mono text-xs uppercase tracking-[0.2em] mb-3" style={{ color: "#002FA7" }}>
                  {d.label}
                </p>
                <p className="font-heading text-sm font-semibold leading-snug">
                  {d.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* IMPACT STATS */}
        <section
          data-navbar-theme="dark"
          className="py-24 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[1] = el; }}
            className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8"
            style={{ opacity: 0 }}
          >
            {[
              { suffix: "+", label: "Projects Delivered" },
              { suffix: "+", label: "Team Members" },
              { suffix: "K+", label: "Value Delivered ($)" },
              { suffix: "%", label: "Alumni Placement" },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-4xl md:text-5xl font-bold mb-1">
                  <span ref={(el) => { numberRefs.current[i] = el; }}>0</span>
                  <span>{stat.suffix}</span>
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.15em]" style={{ color: "#555" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* PROCESS PHASES */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[2] = el; }}
            className="max-w-4xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              The Process
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              Five Phases. One Outcome.
            </h2>

            <div className="space-y-0">
              {phases.map((phase) => (
                <div
                  key={phase.num}
                  className="grid md:grid-cols-[80px_1fr] gap-6 py-10"
                  style={{ borderBottom: "1px solid #1E1E1E" }}
                >
                  <div>
                    <span className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: "#002FA7" }}>
                      Phase {phase.num}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-4 mb-3">
                      <h3 className="font-heading text-xl font-semibold">
                        {phase.title}
                      </h3>
                      <span className="font-mono text-xs uppercase tracking-[0.15em]" style={{ color: "#555" }}>
                        {phase.duration}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#888" }}>
                      {phase.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DELIVERABLES */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[3] = el; }}
            className="max-w-5xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              What You Receive
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              Everything You Need. Nothing More.
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {deliverables.map((d, i) => (
                <div
                  key={d.title}
                  className="rounded-2xl p-8"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <span className="font-mono text-xs uppercase tracking-[0.2em] block mb-4" style={{ color: "#002FA7" }}>
                    0{i + 1}
                  </span>
                  <h3 className="font-heading text-lg font-semibold mb-3">
                    {d.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
                    {d.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          data-navbar-theme="dark"
          className="py-40 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[4] = el; }}
            className="max-w-3xl mx-auto text-center"
            style={{ opacity: 0 }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Join the 2026 Cohort.
            </h2>
            <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: "#888" }}>
              Applications are open until June 30, 2026.
              8 nonprofits will be selected for the next cohort.
            </p>
            <a
              href="/npo/apply"
              className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
              style={{ backgroundColor: "#002FA7" }}
            >
              Apply Now
            </a>
          </div>
        </section>

      </main>
    </SmoothScroll>
  );
}
