"use client";

import SmoothScroll from "@/components/SmoothScroll";
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

const eligibility = [
  "Registered nonprofit or charitable organization",
  "A clear technical need that can be scoped to 8 months",
  "A primary contact available for biweekly check-ins",
  "Willingness to participate in discovery and feedback sessions",
  "No existing vendor contract that conflicts with project scope",
];

const timeline = [
  { date: "Apr 1, 2026", label: "Applications Open", active: true },
  { date: "Jun 30, 2026", label: "Applications Close", active: false },
  { date: "Jul 15, 2026", label: "Shortlist Announced", active: false },
  { date: "Aug 1, 2026", label: "Interviews & Selection", active: false },
  { date: "Sep 1, 2026", label: "Cohort Kickoff", active: false },
];

const faqs = [
  {
    q: "Is there really no cost?",
    a: "None. Tethos is fully funded by sponsors and the university. You pay $0 — not now, not later.",
  },
  {
    q: "What kind of projects do you take on?",
    a: "Web applications, mobile apps, internal tools, donor portals, case management systems — anything that can be scoped, designed, built, and handed off within 8 months.",
  },
  {
    q: "How many nonprofits are selected per cohort?",
    a: "8 nonprofits per cohort. Each is assigned a dedicated team of 4–6 student developers, a designer, and a project lead.",
  },
  {
    q: "Do we own the code?",
    a: "Yes. You receive full source code, documentation, and deployment access. No vendor lock-in, no strings attached.",
  },
  {
    q: "What if we already have a website?",
    a: "That's fine. We build custom software — not marketing sites. If you need a donor portal, scheduling tool, or internal CRM, that's our sweet spot.",
  },
];

export default function ApplyPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

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
              2026 Cohort · Applications Open
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight"
            >
              Apply to Build
              <br />
              <span className="italic font-light" style={{ color: "#888" }}>
                With Tethos.
              </span>
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
              style={{ color: "#888" }}
            >
              8 nonprofits will be selected for the 2026 cohort.
              Each receives a dedicated team, 8 months of development,
              and production-ready software — at no cost.
            </p>
            <div data-reveal className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#"
                className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
                style={{ backgroundColor: "#002FA7" }}
              >
                Start Your Application
              </a>
              <a
                href="#eligibility"
                className="rounded-full px-8 py-4 text-sm font-medium inline-block transition-opacity hover:opacity-80"
                style={{ border: "1px solid #333", color: "#999" }}
              >
                Check Eligibility
              </a>
            </div>
          </div>
        </section>

        {/* APPLICATION TIMELINE */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[0] = el; }}
            className="max-w-4xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4 text-center" style={{ color: "#555" }}>
              Key Dates
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16">
              Application Timeline
            </h2>

            <div className="relative">
              {/* Vertical line */}
              <div
                className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-px"
                style={{ background: "#2A2A2C" }}
              />

              <div className="space-y-12">
                {timeline.map((item, i) => (
                  <div
                    key={item.label}
                    className="relative flex items-start gap-8 pl-16 md:pl-0"
                  >
                    {/* Dot */}
                    <div
                      className="absolute left-4 md:left-1/2 w-4 h-4 rounded-full border-2 md:-translate-x-2"
                      style={{
                        borderColor: item.active ? "#002FA7" : "#2A2A2C",
                        backgroundColor: item.active ? "#002FA7" : "#0F0F10",
                        top: 2,
                      }}
                    />

                    {/* Content */}
                    <div className={`md:w-1/2 ${i % 2 === 0 ? "md:pr-16 md:text-right md:ml-0" : "md:pl-16 md:ml-auto"}`}>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] mb-1" style={{ color: "#002FA7" }}>
                        {item.date}
                      </p>
                      <p className="font-heading text-lg font-semibold">
                        {item.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ELIGIBILITY */}
        <section
          id="eligibility"
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[1] = el; }}
            className="max-w-4xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              Requirements
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              Eligibility Criteria
            </h2>

            <div className="space-y-6">
              {eligibility.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 pb-6"
                  style={{ borderBottom: "1px solid #1E1E1E" }}
                >
                  <span
                    className="font-mono text-xs mt-1 shrink-0"
                    style={{ color: "#002FA7" }}
                  >
                    0{i + 1}
                  </span>
                  <p className="text-base leading-relaxed" style={{ color: "#888" }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHAT TO EXPECT */}
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
              After You Apply
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-6">
              What Happens Next
            </h2>
            <p className="text-base leading-relaxed mb-16 max-w-2xl" style={{ color: "#888" }}>
              Once your application is submitted, our review committee evaluates
              each project based on mission alignment, technical feasibility, and
              potential community impact.
            </p>

            <div className="grid sm:grid-cols-3 gap-5">
              {[
                {
                  step: "01",
                  title: "Review",
                  desc: "Our team reviews your application within 2 weeks of the deadline. We assess scope, impact, and fit.",
                },
                {
                  step: "02",
                  title: "Interview",
                  desc: "Shortlisted organizations are invited for a 30-minute call to discuss goals, constraints, and timeline.",
                },
                {
                  step: "03",
                  title: "Selection",
                  desc: "8 nonprofits are selected and matched with a Tethos team. Kickoff begins in September.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl p-8"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <span className="font-mono text-xs uppercase tracking-[0.2em] block mb-4" style={{ color: "#002FA7" }}>
                    {item.step}
                  </span>
                  <h3 className="font-heading text-lg font-semibold mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[3] = el; }}
            className="max-w-4xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              Questions
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              Frequently Asked
            </h2>

            <div className="space-y-0">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group"
                  style={{ borderBottom: "1px solid #1E1E1E" }}
                >
                  <summary
                    className="flex items-center justify-between py-6 cursor-pointer list-none font-heading text-base font-semibold"
                    style={{ color: "#F5F5F5" }}
                  >
                    {faq.q}
                    <span
                      className="font-mono text-xs transition-transform group-open:rotate-45 shrink-0 ml-4"
                      style={{ color: "#555" }}
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-6 text-sm leading-relaxed max-w-2xl" style={{ color: "#888" }}>
                    {faq.a}
                  </p>
                </details>
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
              Ready to Apply?
            </h2>
            <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: "#888" }}>
              Applications close June 30, 2026. 8 nonprofits will be selected
              for the next cohort.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#"
                className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
                style={{ backgroundColor: "#002FA7" }}
              >
                Start Your Application
              </a>
              <a
                href="#"
                className="rounded-full px-8 py-4 text-sm font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ border: "1px solid #333", color: "#999" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Program Package
              </a>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.15em] mt-12" style={{ color: "#555" }}>
              Questions? Reach out to npo@tethos.ca
            </p>
          </div>
        </section>

      </main>
    </SmoothScroll>
  );
}
