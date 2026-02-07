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
// Sponsor page data
// ============================================

const stats = [
  { value: 50, suffix: "+", label: "Nonprofits Served" },
  { value: 200, suffix: "+", label: "Student Developers" },
  { value: 100, suffix: "+", label: "Projects Completed" },
  { value: 10, suffix: "K+", label: "Lives Impacted" },
];

const sponsorLogos = [
  "Partner Alpha",
  "Partner Beta",
  "Partner Gamma",
  "Partner Delta",
  "Partner Epsilon",
  "Partner Zeta",
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
      "Speaking opportunities, branded workshops, and networking at Genesis and chapter events nationwide.",
  },
];

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
  const statsRef = useRef<HTMLDivElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const whyRef = useRef<HTMLDivElement>(null);
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

      // Scroll-triggered sections
      const revealSections = [whyRef, packageRef, logosRef, galleryRef, testimonialsRef, ctaRef];
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
      {/* White investor-grade page */}
      <main className="min-h-screen bg-white text-gray-900">

        {/* ============================================ */}
        {/* HERO */}
        {/* ============================================ */}
        <section className="min-h-[85vh] flex items-center justify-center px-6 pt-32 pb-20">
          <div ref={heroRef} className="max-w-4xl mx-auto text-center">
            <p
              data-reveal
              className="text-xs font-medium uppercase tracking-[0.25em] text-gray-400 mb-6"
            >
              For Sponsors
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-tight text-gray-900"
            >
              Fund Technology
              <br />
              That Matters.
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Support the next generation of developers while enabling nonprofits
              to leverage technology for greater good.
            </p>
            <div data-reveal className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="rounded-full bg-gray-900 px-8 py-4 text-sm font-medium text-white transition-all hover:bg-gray-800">
                Become a Sponsor
              </button>
              <a
                href="/sponsorship-package.pdf"
                className="rounded-full border border-gray-300 px-8 py-4 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:text-gray-900 inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Package (PDF)
              </a>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* IMPACT STATS */}
        {/* ============================================ */}
        <section className="py-20 px-6 border-t border-gray-100">
          <div ref={statsRef} className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-1">
                  <span ref={(el) => { numberRefs.current[i] = el; }}>0</span>
                  <span>{stat.suffix}</span>
                </div>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================ */}
        {/* WHY SPONSOR */}
        {/* ============================================ */}
        <section className="py-24 px-6">
          <div ref={whyRef} className="max-w-4xl mx-auto text-center" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-6 text-gray-900">
              Why Sponsor Tethos
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Your sponsorship directly funds student development teams building
              real software for nonprofits. It&apos;s not charity — it&apos;s investment
              in talent, technology, and social infrastructure. Every dollar
              translates to measurable output: code shipped, organizations served,
              careers launched.
            </p>
          </div>
        </section>

        {/* ============================================ */}
        {/* SPONSORSHIP PACKAGE */}
        {/* ============================================ */}
        <section className="py-24 px-6 bg-gray-50">
          <div ref={packageRef} className="max-w-5xl mx-auto" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16 text-gray-900">
              What You Get
            </h2>
            <div className="grid sm:grid-cols-2 gap-8">
              {packageHighlights.map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl border border-gray-200 p-8 transition-shadow duration-300 hover:shadow-lg"
                >
                  <h3 className="font-heading text-xl font-semibold mb-3 text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* PAST SPONSORS */}
        {/* ============================================ */}
        <section className="py-20 px-6">
          <div ref={logosRef} className="max-w-4xl mx-auto text-center" style={{ opacity: 0 }}>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-gray-400 mb-10">
              Past &amp; Current Sponsors
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 items-center">
              {sponsorLogos.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-center h-12 opacity-40 hover:opacity-70 transition-opacity duration-300"
                >
                  <span className="font-heading text-sm font-semibold text-gray-500">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* EVENT PHOTOS */}
        {/* ============================================ */}
        <section className="py-24 px-6 bg-gray-50">
          <div ref={galleryRef} className="max-w-5xl mx-auto" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-12 text-gray-900">
              Events &amp; Community
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-xl bg-gray-200 flex items-center justify-center"
                >
                  <span className="text-gray-400 text-sm">Event Photo {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* TESTIMONIALS */}
        {/* ============================================ */}
        <section className="py-24 px-6">
          <div ref={testimonialsRef} className="max-w-4xl mx-auto" style={{ opacity: 0 }}>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16 text-gray-900">
              What Sponsors Say
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {testimonials.map((t) => (
                <div
                  key={t.author}
                  className="bg-gray-50 rounded-2xl p-8 border border-gray-100"
                >
                  <blockquote className="text-base text-gray-600 leading-relaxed mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div>
                    <p className="font-heading text-sm font-semibold text-gray-900">
                      {t.author}
                    </p>
                    <p className="text-xs text-gray-400">
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
        <section className="py-24 px-6 bg-gray-900 text-white">
          <div ref={ctaRef} className="max-w-3xl mx-auto text-center" style={{ opacity: 0 }}>
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Let&apos;s Talk.
            </h2>
            <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto">
              We&apos;d love to discuss how a partnership with Tethos can align with
              your organization&apos;s goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="rounded-full bg-white px-8 py-4 text-sm font-medium text-gray-900 transition-all hover:bg-gray-100">
                Schedule a Call
              </button>
              <button className="rounded-full border border-gray-600 px-8 py-4 text-sm font-medium text-gray-300 transition-all hover:border-gray-400 hover:text-white">
                Email Us
              </button>
            </div>
          </div>
        </section>
      </main>
    </SmoothScroll>
  );
}
