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
} from "@/lib/motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const featuredQuote = {
  quote:
    "Working with Tethos transformed how we serve our community. They didn't just build software — they took the time to understand our mission and delivered something we could actually sustain. I've never worked with a team this dedicated.",
  author: "Maria Chen",
  role: "Executive Director",
  org: "BrightAid Foundation",
  project: "Donor Nexus",
};

const testimonials = [
  {
    quote:
      "I've worked with agencies that cost ten times as much and delivered half as much. These students are serious professionals. The handoff was impeccable — our staff was trained and ready on day one.",
    author: "James Okafor",
    role: "Operations Lead",
    org: "ShelterNet",
    project: "Hearth",
  },
  {
    quote:
      "The route optimization tool they built saves our volunteer drivers 3 hours per week. That's 3 hours of more meals delivered. Real impact from real software.",
    author: "Lisa Park",
    role: "Logistics Director",
    org: "FoodBridge",
    project: "Green Routes",
  },
  {
    quote:
      "Our grant reporting used to take 3 days of manual work. Now it takes 20 minutes. The milestone tracker they built has already helped us secure two new grants.",
    author: "Robert Nguyen",
    role: "Grants Manager",
    org: "GrantWorks",
    project: "Grant Glass",
  },
  {
    quote:
      "We were skeptical. A student team? Pro-bono? It sounded too good to be true. But from the first discovery session, we knew these were serious people doing serious work.",
    author: "Angela Torres",
    role: "Program Director",
    org: "YouthRise",
    project: "Pathways",
  },
  {
    quote:
      "The screening tool reduced our intake time by 60%. More importantly, the care-path suggestions have improved outcomes for patients who might otherwise fall through the cracks.",
    author: "Dr. Amara Wilson",
    role: "Clinical Director",
    org: "HealthConnect",
    project: "Pulse",
  },
  {
    quote:
      "What impressed me most was the documentation. When the project was handed off, any developer could pick it up. That's rare — even with paid agencies.",
    author: "Kevin Reid",
    role: "CTO",
    org: "ShelterBridge",
    project: "Bridge Link",
  },
];

const partnerOrgs = [
  "BrightAid Foundation",
  "ShelterNet",
  "FoodBridge",
  "YouthRise",
  "GrantWorks",
  "HealthConnect",
  "ShelterBridge",
  "GreenSteps",
];

export default function VoicesPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLQuoteElement>(null);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
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

      // Featured quote cinematic reveal
      if (featuredRef.current) {
        gsap.fromTo(
          featuredRef.current,
          { opacity: 0, y: 56, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: DURATION_CINEMATIC,
            ease: EASE_SMOOTH,
            scrollTrigger: {
              trigger: featuredRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      }

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
              Partner Voices
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight"
            >
              In Their
              <br />
              <span className="italic font-light" style={{ color: "#888" }}>
                Own Words.
              </span>
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: "#888" }}
            >
              Real feedback from the nonprofit leaders who partnered with Tethos.
              No scripts. No spin. Just outcomes.
            </p>
          </div>
        </section>

        {/* FEATURED TESTIMONIAL */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{
            borderTop: "1px solid #1E1E1E",
            background: "radial-gradient(ellipse at 50% 60%, #151518, #0F0F10)",
          }}
        >
          <blockquote
            ref={featuredRef}
            className="max-w-4xl mx-auto text-center relative"
            style={{ opacity: 0 }}
          >
            {/* Decorative quote mark */}
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none select-none"
              style={{
                fontFamily: "var(--font-heading), Georgia, serif",
                fontSize: "clamp(120px, 16vw, 240px)",
                fontWeight: 300,
                color: "rgba(241, 255, 255, 0.03)",
                lineHeight: 1,
              }}
            >
              &ldquo;
            </div>

            <p
              className="font-heading text-2xl md:text-3xl lg:text-4xl italic font-light leading-snug mb-12 relative z-10"
              style={{ color: "#F5F2EB" }}
            >
              &ldquo;{featuredQuote.quote}&rdquo;
            </p>
            <footer>
              <div
                className="w-8 h-px mx-auto mb-5"
                style={{ background: "#ffd166" }}
              />
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] mb-1">
                {featuredQuote.author}
              </p>
              <p className="font-mono text-xs" style={{ color: "#555" }}>
                {featuredQuote.role} · {featuredQuote.org}
              </p>
              <p className="font-mono text-xs mt-1" style={{ color: "#002FA7" }}>
                Project: {featuredQuote.project}
              </p>
            </footer>
          </blockquote>
        </section>

        {/* ALL TESTIMONIALS */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[0] = el; }}
            className="max-w-5xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              Testimonials
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              More From Our Partners
            </h2>

            <div className="grid md:grid-cols-2 gap-5">
              {testimonials.map((t) => (
                <div
                  key={t.author}
                  className="rounded-2xl p-8 flex flex-col"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <blockquote className="text-base leading-relaxed mb-8 flex-1" style={{ color: "#888" }}>
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div
                    className="pt-6"
                    style={{ borderTop: "1px solid #2A2A2C" }}
                  >
                    <p className="font-heading text-sm font-semibold">
                      {t.author}
                    </p>
                    <p className="font-mono text-xs mt-1" style={{ color: "#555" }}>
                      {t.role}, {t.org}
                    </p>
                    <p className="font-mono text-xs mt-1" style={{ color: "#002FA7" }}>
                      Project: {t.project}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PARTNER ORGANIZATIONS */}
        <section
          data-navbar-theme="dark"
          className="py-24 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[1] = el; }}
            className="max-w-4xl mx-auto text-center"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-12" style={{ color: "#555" }}>
              Organizations We&rsquo;ve Served
            </p>
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-6">
              {partnerOrgs.map((org) => (
                <span
                  key={org}
                  className="font-heading text-sm font-semibold transition-opacity duration-300 hover:opacity-100"
                  style={{ opacity: 0.45 }}
                >
                  {org}
                </span>
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
            ref={(el) => { sectionsRef.current[2] = el; }}
            className="max-w-3xl mx-auto text-center"
            style={{ opacity: 0 }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Your Story Could Be Next.
            </h2>
            <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: "#888" }}>
              Join the nonprofits already building with Tethos.
              Applications for the 2026 cohort are open.
            </p>
            <a
              href="/npo/apply"
              className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
              style={{ backgroundColor: "#002FA7" }}
            >
              Apply for 2026 Cohort
            </a>
          </div>
        </section>

      </main>
    </SmoothScroll>
  );
}
