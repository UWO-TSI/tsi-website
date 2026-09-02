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

const stats = [
  { value: 20, suffix: "+", label: "Projects Completed" },
  { value: 150, suffix: "+", label: "Alumni & Members" },
  { value: 1500, suffix: "+", label: "Community Reach" },
  { value: 200, suffix: "K+", label: "Value Delivered ($)" },
  { value: 85, suffix: "%", label: "Alumni Placement Rate" },
  { value: 3, suffix: "", label: "University Chapters" },
];

const projects = [
  {
    name: "Donor Nexus",
    org: "BrightAid",
    desc: "Recurring giving portal with wallet pay and donor analytics. Increased online donations by 340% in the first quarter.",
    tags: ["Next.js", "Stripe", "Postgres"],
    impact: "340% donation increase",
  },
  {
    name: "Hearth",
    org: "ShelterNet",
    desc: "Privacy-safe case tracking with grant-ready exports. Reduced reporting time from 3 days to 20 minutes.",
    tags: ["React", "Supabase", "Auth"],
    impact: "95% time saved on reports",
  },
  {
    name: "Green Routes",
    org: "FoodBridge",
    desc: "Route batching, live ETAs, and volunteer mobile handoffs. Serves 2,400 more meals per month.",
    tags: ["Mapbox", "Node", "Redis"],
    impact: "2,400 more meals/month",
  },
  {
    name: "Pathways",
    org: "YouthRise",
    desc: "Mentor-mentee matching based on goals, time, and proximity. Connected 180 at-risk youth with mentors.",
    tags: ["Next.js", "Postgres", "Clerk"],
    impact: "180 youth matched",
  },
  {
    name: "Grant Glass",
    org: "GrantWorks",
    desc: "Milestone tracker with exportable narratives and budget rollups. Helped secure $1.2M in follow-on grants.",
    tags: ["Supabase", "React", "Tailwind"],
    impact: "$1.2M grants secured",
  },
  {
    name: "Pulse",
    org: "HealthConnect",
    desc: "Mobile-first intake with scoring and care-path suggestions. Screening time reduced by 60%.",
    tags: ["Next.js", "Zod", "Prisma"],
    impact: "60% faster screening",
  },
];

const testimonials = [
  {
    quote: "Working with Tethos transformed how we serve our community. They didn't just build software — they took the time to understand our mission and delivered something we could actually sustain.",
    author: "Maria Chen",
    role: "Executive Director",
    org: "BrightAid Foundation",
  },
  {
    quote: "I've worked with agencies that cost ten times as much and delivered half as much. These students are serious professionals. The handoff was impeccable.",
    author: "James Okafor",
    role: "Operations Lead",
    org: "ShelterNet",
  },
];

export default function ImpactPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);

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
              Impact Report
            </p>
            <h1
              data-reveal
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.05] tracking-tight"
            >
              Real Work.
              <br />
              <span className="italic font-light" style={{ color: "#888" }}>
                Real Outcomes.
              </span>
            </h1>
            <p
              data-reveal
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: "#888" }}
            >
              Since 2022, Tethos has delivered production-ready software to
              nonprofits across Canada — at no cost. Here&rsquo;s what that looks like.
            </p>
          </div>
        </section>

        {/* STATS */}
        <section
          data-navbar-theme="dark"
          className="py-24 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[0] = el; }}
            className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8"
            style={{ opacity: 0 }}
          >
            {stats.map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-3xl md:text-4xl font-bold mb-1">
                  {i === 3 && <span>$</span>}
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

        {/* PROJECT CASE STUDIES */}
        <section
          data-navbar-theme="dark"
          className="py-32 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[1] = el; }}
            className="max-w-5xl mx-auto"
            style={{ opacity: 0 }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4" style={{ color: "#555" }}>
              Project Gallery / 2022–2026
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-16">
              Featured Projects
            </h2>

            <div className="space-y-0">
              {projects.map((p, i) => (
                <div
                  key={p.name}
                  className="grid md:grid-cols-[1fr_2fr] gap-8 py-10"
                  style={{ borderBottom: "1px solid #1E1E1E" }}
                >
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] mb-2" style={{ color: "#002FA7" }}>
                      {p.org}
                    </p>
                    <h3 className="font-heading text-2xl font-semibold mb-3">
                      {p.name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {p.tags.map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-xs px-2 py-0.5 rounded"
                          style={{ border: "1px solid #2A2A2C", color: "#555" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: "#888" }}>
                      {p.desc}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#002FA7" }} />
                      <span className="font-mono text-xs uppercase tracking-[0.15em]" style={{ color: "#002FA7" }}>
                        {p.impact}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
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
            <p className="font-mono text-xs uppercase tracking-[0.3em] mb-4 text-center" style={{ color: "#555" }}>
              In Their Words
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-center mb-16">
              What Partners Say
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
                    <p className="font-heading text-sm font-semibold">
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

        {/* CTA */}
        <section
          data-navbar-theme="dark"
          className="py-40 px-6"
          style={{ borderTop: "1px solid #1E1E1E" }}
        >
          <div
            ref={(el) => { sectionsRef.current[3] = el; }}
            className="max-w-3xl mx-auto text-center"
            style={{ opacity: 0 }}
          >
            <h2 className="font-heading text-4xl md:text-5xl font-semibold mb-6">
              Your Project Could Be Next.
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
