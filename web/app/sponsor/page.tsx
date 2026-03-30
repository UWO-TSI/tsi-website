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

// ============================================
// Data
// ============================================

const tiers = [
  {
    name: "Silver",
    color: "#A0A0A0",
    perks: [
      "Logo on website & event materials",
      "Social media shoutout",
      "Event access for 2 reps",
      "Thank-you in program booklet",
    ],
    featured: false,
  },
  {
    name: "Gold",
    color: "#C9A84C",
    perks: [
      "Everything in Silver",
      "Speaking slot at Genesis 2026",
      "Quarterly impact report",
      "Event access for 4 reps",
    ],
    featured: false,
  },
  {
    name: "Platinum",
    color: "#E5E5E5",
    perks: [
      "Everything in Gold",
      "Talent pipeline & resume access",
      "Branded workshop or panel",
      "Event access for 6 reps",
    ],
    featured: false,
  },
  {
    name: "Catalyst",
    color: "#002FA7",
    perks: [
      "Everything in Platinum",
      "Named partnership across all channels",
      "Quarterly leadership review",
      "Featured in all Genesis materials",
    ],
    featured: true,
  },
];

const currentSponsors = [
  { name: "Morrissette Entrepreneurship", org: "Western University" },
  { name: "Placeholder Sponsor", org: "" },
  { name: "Placeholder Sponsor", org: "" },
];

// TODO: replace with real stats
const stats = [
  { value: 50,  suffix: "+",  label: "Nonprofits Served" },
  { value: 200, suffix: "+",  label: "Student Developers" },
  { value: 100, suffix: "+",  label: "Projects Completed" },
  { value: 10,  suffix: "K+", label: "Lives Impacted" },
];

const packageHighlights = [
  {
    title: "Brand Visibility",
    description:
      "Logo placement across our platform, events, and marketing materials reaching thousands of students and nonprofit partners.",
  },
  {
    title: "Talent Pipeline",
    description:
      "Early and priority access to our top student developers for internships, co-ops, and full-time positions.",
  },
  {
    title: "Impact Reports",
    description:
      "Quarterly reports detailing how your sponsorship directly enables technology for social good.",
  },
  {
    title: "Event Access",
    description:
      "Speaking opportunities, branded workshops, and networking at Genesis and chapter events across the country.",
  },
];

// TODO: replace with real sponsor testimonials
const testimonials = [
  {
    quote:
      "Tethos gave us direct access to mission-driven developers who actually understand the nonprofit space. The ROI goes far beyond recruitment.",
    author: "Jane Smith",
    role: "VP of Partnerships",
    org: "TechCorp Foundation",
  },
  {
    quote:
      "Sponsoring Tethos is one of the highest-impact investments in our CSR portfolio. The transparency and professionalism exceeded our expectations.",
    author: "Michael Chen",
    role: "Director of Social Impact",
    org: "Innovate Inc.",
  },
];

export default function SponsorPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tiersRef = useRef<HTMLDivElement>(null);
  const tierCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const statsRef = useRef<HTMLDivElement>(null);
  const packageRef = useRef<HTMLDivElement>(null);
  const logosRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

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

      // Tier cards stagger reveal
      tierCardRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            delay: i * 0.1,
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      // Animated stat counters
      numberRefs.current.forEach((el, i) => {
        if (!el) return;
        const target = stats[i].value;
        const obj = { value: 0 };
        ScrollTrigger.create({
          trigger: el,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              value: target,
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

      // Scroll-triggered section reveals
      const revealSections = [statsRef, packageRef, logosRef, galleryRef, testimonialsRef, ctaRef];
      revealSections.forEach((ref) => {
        if (!ref.current) return;
        gsap.fromTo(
          ref.current,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: DURATION_SECTION,
            ease: EASE_ENTER,
            scrollTrigger: {
              trigger: ref.current,
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

        {/* ============================================ */}
        {/* HERO */}
        {/* ============================================ */}
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
              Sponsor Pathway
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight"
            >
              Fund Technology
              <br />
              That Matters.
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
              style={{ color: "#888" }}
            >
              Support the next generation of developers while enabling nonprofits
              to leverage technology for greater impact.
            </p>
            <div data-reveal className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#contact"
                className="rounded-full px-8 py-4 text-sm font-medium text-white transition-opacity hover:opacity-80 inline-block"
                style={{ backgroundColor: "#002FA7" }}
              >
                Become a Sponsor
              </a>
              <a
                href="/genesis-2026-sponsorship-package.pdf"
                target="_blank"
                rel="noopener noreferrer"
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

        {/* ============================================ */}
        {/* GENESIS SPONSORSHIP TIERS */}
        {/* ============================================ */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div className="max-w-6xl mx-auto">
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4 text-center" style={{ color: "#555" }}>
              Genesis 2026
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16">
              Sponsorship Tiers
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {tiers.map((tier, i) => (
                <div
                  key={tier.name}
                  ref={(el) => { tierCardRefs.current[i] = el; }}
                  className="rounded-2xl p-8 flex flex-col"
                  style={{
                    backgroundColor: "#1A1A1C",
                    border: tier.featured ? `1px solid #002FA7` : "1px solid #2A2A2C",
                    opacity: 0,
                  }}
                >
                  <div className="mb-6">
                    <div
                      className="font-mono text-xs uppercase tracking-[0.2em] mb-2"
                      style={{ color: tier.color }}
                    >
                      {tier.name}
                    </div>
                    <div className="font-heading text-lg font-semibold" style={{ color: "#F5F5F5" }}>
                      Contact for pricing
                    </div>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {tier.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-3 text-sm" style={{ color: "#888" }}>
                        <span className="mt-0.5 shrink-0" style={{ color: tier.featured ? "#002FA7" : "#444" }}>
                          ✓
                        </span>
                        {perk}
                      </li>
                    ))}
                  </ul>
                  {tier.featured && (
                    <div
                      className="mt-6 pt-5 font-mono text-xs uppercase tracking-[0.2em] text-center"
                      style={{ borderTop: "1px solid #2A2A2C", color: "#002FA7" }}
                    >
                      Featured Tier
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* CURRENT SPONSORS */}
        {/* ============================================ */}
        <section
          data-navbar-theme="dark"
          className="py-24 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div ref={logosRef} className="max-w-4xl mx-auto text-center" style={{ opacity: 0 }}>
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-12" style={{ color: "#555" }}>
              Trusted By
            </p>
            <div className="flex flex-wrap justify-center gap-12 items-center">
              {currentSponsors.map((s, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 transition-opacity duration-300 hover:opacity-100"
                  style={{ opacity: 0.45 }}
                >
                  <span className="font-heading text-sm font-semibold" style={{ color: "#F5F5F5" }}>
                    {s.name}
                  </span>
                  {s.org && (
                    <span className="font-mono text-xs" style={{ color: "#666" }}>
                      {s.org}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* IMPACT STATS */}
        {/* ============================================ */}
        {/* TODO: replace with real stats */}
        <section
          data-navbar-theme="dark"
          className="py-24 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div ref={statsRef} className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8" style={{ opacity: 0 }}>
            {stats.map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-4xl md:text-5xl font-bold mb-1" style={{ color: "#F5F5F5" }}>
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

        {/* ============================================ */}
        {/* WHAT YOU GET */}
        {/* ============================================ */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div ref={packageRef} className="max-w-5xl mx-auto" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16">
              What Your Sponsorship Enables
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {packageHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl p-8"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <h3 className="font-heading text-lg font-semibold mb-3" style={{ color: "#F5F5F5" }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* EVENT GALLERY (placeholder) */}
        {/* ============================================ */}
        {/* TODO: replace with real event photos */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div ref={galleryRef} className="max-w-5xl mx-auto" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-12">
              Genesis &amp; Community
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <span className="font-mono text-xs" style={{ color: "#444" }}>
                    Event Photo {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* TESTIMONIALS (placeholder) */}
        {/* ============================================ */}
        {/* TODO: replace with real sponsor testimonials */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div ref={testimonialsRef} className="max-w-4xl mx-auto" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16">
              What Sponsors Say
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              {testimonials.map((t) => (
                <div
                  key={t.author}
                  className="rounded-2xl p-8"
                  style={{ backgroundColor: "#1A1A1C", border: "1px solid #2A2A2C" }}
                >
                  <blockquote className="text-base leading-relaxed mb-8" style={{ color: "#888" }}>
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div>
                    <p className="font-heading text-sm font-semibold" style={{ color: "#F5F5F5" }}>
                      {t.author}
                    </p>
                    <p className="font-mono text-xs mt-1" style={{ color: "#555" }}>
                      {t.role}, {t.org}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* CONTACT CTA */}
        {/* ============================================ */}
        <section
          id="contact"
          data-navbar-theme="dark"
          className="py-40 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div ref={ctaRef} className="max-w-3xl mx-auto text-center" style={{ opacity: 0 }}>
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Let&apos;s Build Together.
            </h2>
            <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: "#888" }}>
              Partner with Tethos to invest in the next generation of technology leaders and the nonprofits they serve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/genesis-2026-sponsorship-package.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-8 py-4 text-sm font-medium text-white inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#002FA7" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Sponsorship Package
              </a>
              <a
                href="mailto:sponsor@tethos.ca"
                className="rounded-full px-8 py-4 text-sm font-medium inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                style={{ border: "1px solid #333", color: "#999" }}
              >
                Get in Touch
              </a>
            </div>
          </div>
        </section>

      </main>
    </SmoothScroll>
  );
}
