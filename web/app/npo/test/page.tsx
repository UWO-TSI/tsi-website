"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Cormorant_Garamond, Inter, Space_Mono } from "next/font/google";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ─── Fonts ───────────────────────────────────────────────────────────── */

const cgFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--f-cg",
  display: "swap",
});

const interFont = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--f-inter",
  display: "swap",
});

const monoFont = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--f-mono",
  display: "swap",
});

/* ─── Palette ─────────────────────────────────────────────────────────── */

const C = {
  bg:    "#F7F5F1",
  ink:   "#0F0D0B",
  blue:  "#1030C8",
  muted: "#7A7268",
  dim:   "#3D3A36",
  card:  "#EDEBE4",
  dark:  "#0F0D0B",
  ds:    "#1C1916",
  cream: "#F5F2EB",
  rule:  "rgba(15,13,11,0.12)",
} as const;

/* ─── Style helpers ───────────────────────────────────────────────────── */

const cg = (size: string | number, weight = 400, italic = false): CSSProperties => ({
  fontFamily: "var(--f-cg), Georgia, serif",
  fontSize: typeof size === "number" ? `${size}px` : size,
  fontWeight: weight,
  fontStyle: italic ? "italic" : "normal",
  lineHeight: 1.05,
  letterSpacing: "-0.01em",
});

const it = (size: string | number = 16, weight = 400): CSSProperties => ({
  fontFamily: "var(--f-inter), system-ui, sans-serif",
  fontSize: typeof size === "number" ? `${size}px` : size,
  fontWeight: weight,
  lineHeight: 1.65,
});

const mn = (size: string | number = 11, weight = 400): CSSProperties => ({
  fontFamily: "var(--f-mono), 'Courier New', monospace",
  fontSize: typeof size === "number" ? `${size}px` : size,
  fontWeight: weight,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
});

/* ─── Reveal hook ─────────────────────────────────────────────────────── */

function useReveal(ref: React.RefObject<HTMLElement | null>, opts: { delay?: number; y?: number } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: opts.y ?? 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
          delay: opts.delay ?? 0,
          scrollTrigger: {
            trigger: el,
            start: "top 82%",
            toggleActions: "play none none none",
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);
}

function useRevealChildren(containerRef: React.RefObject<HTMLElement | null>, selector: string, stagger = 0.12) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const children = el.querySelectorAll(selector);
      gsap.fromTo(
        children,
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: 1.0,
          ease: "power3.out",
          stagger,
          scrollTrigger: {
            trigger: el,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);
}

/* ─── Data ────────────────────────────────────────────────────────────── */

const processSteps = [
  { num: "01", phase: "Application", duration: "2 weeks",
    desc: "Nonprofits submit a brief application describing their mission and technical needs. We select based on impact potential and feasibility." },
  { num: "02", phase: "Discovery", duration: "3 weeks",
    desc: "We embed with your team. Stakeholder interviews, workflow mapping, and requirements gathering produce a single clear project brief." },
  { num: "03", phase: "Design", duration: "4 weeks",
    desc: "Information architecture, wireframes, and a high-fidelity prototype. You iterate until the solution feels native to your organization." },
  { num: "04", phase: "Development", duration: "16 weeks",
    desc: "Sprint-based engineering with biweekly demos. Working software ships early. You steer direction throughout." },
  { num: "05", phase: "Handoff", duration: "3 weeks",
    desc: "Production deployment, staff training, technical documentation, and 30 days of post-launch support. No strings attached." },
];

const deliverables = [
  { icon: "⬡", title: "Production App", desc: "Deployed, tested, and live from day one." },
  { icon: "◎", title: "Full Source Code", desc: "Complete repository, yours to own forever." },
  { icon: "△", title: "Design Files", desc: "Figma source, assets, brand integration." },
  { icon: "⊡", title: "Documentation", desc: "Technical docs so any developer can pick it up." },
  { icon: "◷", title: "Staff Training", desc: "Live sessions plus recorded walkthroughs." },
  { icon: "◈", title: "Impact Report", desc: "Outcomes, metrics, and a clear path forward." },
];

const projects = [
  { name: "Donor Nexus", org: "BrightAid", desc: "Recurring giving portal with wallet pay and donor analytics.", tags: ["Next.js", "Stripe", "Postgres"] },
  { name: "Hearth", org: "ShelterNet", desc: "Privacy-safe case tracking with grant-ready exports.", tags: ["React", "Supabase", "Auth"] },
  { name: "Green Routes", org: "FoodBridge", desc: "Route batching, live ETAs, and volunteer mobile handoffs.", tags: ["Mapbox", "Node", "Redis"] },
  { name: "Pathways", org: "YouthRise", desc: "Mentor-mentee matching based on goals, time, and proximity.", tags: ["Next.js", "Postgres", "Clerk"] },
  { name: "Grant Glass", org: "GrantWorks", desc: "Milestone tracker with exportable narratives and budget rollups.", tags: ["Supabase", "React", "Tailwind"] },
  { name: "Pulse", org: "HealthConnect", desc: "Mobile-first intake with scoring and care-path suggestions.", tags: ["Next.js", "Zod", "Prisma"] },
];

/* ─── Marquee items ───────────────────────────────────────────────────── */

const marqueeItems = [
  "Pro-bono", "Production-ready", "No cost", "Real impact",
  "8 months", "Discovery to deployment", "Built by students",
];

/* ─── Components ──────────────────────────────────────────────────────── */

function Divider() {
  return <div style={{ width: "100%", height: 1, background: C.rule }} />;
}

function Label({ children, color = C.muted }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ ...mn(10), color, display: "block", marginBottom: 16 }}>
      {children}
    </span>
  );
}

/* Hero */
function Hero() {
  const headlineRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headlineRef.current,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 1.4, ease: "power4.out", delay: 0.3 }
      );
      gsap.fromTo(
        bottomRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.0, ease: "power2.out", delay: 0.9 }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      style={{
        background: C.dark,
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(24px, 4vw, 48px)",
      }}
    >
      {/* Nav bar */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "auto",
        }}
      >
        <span style={{ ...mn(11, 700), color: C.cream }}>TETHOS</span>
        <span style={{ ...mn(10), color: C.muted }}>NPO Program · 2026</span>
      </nav>

      {/* Headline */}
      <div
        ref={headlineRef}
        style={{ opacity: 0, flex: 1, display: "flex", alignItems: "center", paddingBlock: "clamp(48px, 8vh, 120px)" }}
      >
        <h1
          style={{
            ...cg("clamp(72px, 10vw, 148px)", 400),
            color: C.cream,
            maxWidth: "14ch",
          }}
        >
          Software
          <br />
          That Serves
          <br />
          <em style={{ fontStyle: "italic", fontWeight: 300, color: "#A8A29E" }}>
            a Purpose.
          </em>
        </h1>
      </div>

      {/* Bottom bar */}
      <div ref={bottomRef} style={{ opacity: 0 }}>
        <Divider />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 24,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <p style={{ ...it(14), color: C.muted, maxWidth: 420 }}>
            An 8-month pro-bono initiative — from discovery to deployment,
            at no cost to your organization.
          </p>
          <a
            href="#apply"
            style={{
              ...mn(11, 700),
              color: C.cream,
              background: C.blue,
              padding: "14px 28px",
              borderRadius: 4,
              textDecoration: "none",
              letterSpacing: "0.15em",
              whiteSpace: "nowrap",
            }}
          >
            Apply Now ↗
          </a>
        </div>
      </div>
    </section>
  );
}

/* Marquee */
function Marquee() {
  const items = [...marqueeItems, ...marqueeItems];
  return (
    <div
      style={{
        background: C.blue,
        overflow: "hidden",
        padding: "18px 0",
        borderTop: `1px solid rgba(255,255,255,0.1)`,
      }}
    >
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track { animation: marquee-scroll 28s linear infinite; }
      `}</style>
      <div className="marquee-track" style={{ display: "flex", width: "max-content", gap: 0 }}>
        {items.map((item, i) => (
          <span
            key={i}
            style={{
              ...mn(11, 400),
              color: "rgba(255,255,255,0.85)",
              padding: "0 40px",
              borderRight: "1px solid rgba(255,255,255,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Stats */
function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const numRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const statData = [
    { val: 20, suffix: "+", label: "Projects completed" },
    { val: 150, suffix: "+", label: "Alumni & members" },
    { val: 200, suffix: "K+", label: "Value delivered ($)" },
    { val: 8, suffix: " mo", label: "Per project" },
  ];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      statData.forEach((s, i) => {
        const numEl = numRefs.current[i];
        if (!numEl) return;
        gsap.fromTo(
          { v: 0 },
          { v: s.val },
          {
            duration: 1.6,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none none" },
            onUpdate: function () {
              if (numEl) numEl.textContent = String(Math.round(this.targets()[0].v));
            },
          }
        );
      });

      gsap.fromTo(
        el.querySelectorAll(".stat-item"),
        { opacity: 0, y: 32 },
        {
          opacity: 1, y: 0, duration: 1.0, ease: "power3.out", stagger: 0.1,
          scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
        borderBottom: `1px solid ${C.rule}`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "clamp(24px, 4vw, 48px)",
        }}
      >
        {statData.map((s, i) => (
          <div
            key={s.label}
            className="stat-item"
            style={{
              opacity: 0,
              paddingRight: i < 3 ? "clamp(24px, 4vw, 48px)" : 0,
              borderRight: i < 3 ? `1px solid ${C.rule}` : "none",
            }}
          >
            <div
              style={{
                ...mn("clamp(40px, 5vw, 64px)", 700),
                color: C.ink,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginBottom: 12,
                display: "flex",
                alignItems: "baseline",
                gap: 2,
              }}
            >
              <span ref={(el) => { numRefs.current[i] = el; }}>{s.val}</span>
              <span style={{ fontSize: "0.65em" }}>{s.suffix}</span>
            </div>
            <p style={{ ...it(13), color: C.muted, lineHeight: 1.4 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Pull quote between stats and process */
function PullQuote() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref as React.RefObject<HTMLElement>);

  return (
    <section
      ref={ref}
      style={{
        opacity: 0,
        background: C.bg,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
        borderBottom: `1px solid ${C.rule}`,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <p
          style={{
            ...cg("clamp(32px, 4.5vw, 64px)", 400, true),
            color: C.ink,
            lineHeight: 1.2,
          }}
        >
          &ldquo;We&rsquo;re not a consultancy. We&rsquo;re a collective of students who believe nonprofits deserve the same software as Fortune 500 companies.&rdquo;
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40 }}>
          <div style={{ width: 32, height: 1, background: C.blue }} />
          <span style={{ ...mn(10), color: C.blue }}>Tethos · NPO Program</span>
        </div>
      </div>
    </section>
  );
}

/* Process */
function Process() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const rows = el.querySelectorAll(".process-row");
      rows.forEach((row, i) => {
        gsap.fromTo(
          row,
          { opacity: 0, x: -24 },
          {
            opacity: 1, x: 0, duration: 0.9, ease: "power3.out",
            delay: i * 0.08,
            scrollTrigger: { trigger: row, start: "top 85%", toggleActions: "play none none none" },
          }
        );
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 64 }}>
          <Label>The Process</Label>
          <h2 style={{ ...cg("clamp(40px, 5vw, 72px)", 400), color: C.ink }}>
            Five phases.
            <br />
            <em style={{ fontWeight: 300, color: C.muted }}>One outcome.</em>
          </h2>
        </div>

        <div>
          {processSteps.map((step, i) => (
            <div key={step.num}>
              <Divider />
              <div
                className="process-row"
                style={{
                  opacity: 0,
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 1fr 120px",
                  gap: "clamp(16px, 3vw, 48px)",
                  alignItems: "start",
                  padding: "clamp(24px, 4vh, 40px) 0",
                }}
              >
                {/* Number */}
                <span style={{ ...mn("clamp(20px, 2.5vw, 30px)", 400), color: C.blue, lineHeight: 1 }}>
                  {step.num}
                </span>
                {/* Phase name */}
                <h3 style={{ ...cg("clamp(24px, 2.5vw, 36px)", 500), color: C.ink }}>
                  {step.phase}
                </h3>
                {/* Description */}
                <p style={{ ...it(15), color: C.dim, lineHeight: 1.7 }}>
                  {step.desc}
                </p>
                {/* Duration */}
                <span style={{ ...mn(10), color: C.muted, textAlign: "right", paddingTop: 6 }}>
                  {step.duration}
                </span>
              </div>
            </div>
          ))}
          <Divider />
        </div>
      </div>
    </section>
  );
}

/* Deliverables */
function Deliverables() {
  const ref = useRef<HTMLElement>(null);
  useRevealChildren(ref as React.RefObject<HTMLElement>, ".del-card");

  return (
    <section
      ref={ref}
      style={{
        background: C.dark,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 64 }}>
          <Label color="#5A5650">What You Receive</Label>
          <h2 style={{ ...cg("clamp(40px, 5vw, 72px)", 400), color: C.cream }}>
            Everything you need.
            <br />
            <em style={{ fontWeight: 300, color: "#5A5650" }}>Nothing more.</em>
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
          }}
        >
          {deliverables.map((d, i) => (
            <div
              key={d.title}
              className="del-card"
              style={{
                opacity: 0,
                background: C.ds,
                padding: "clamp(32px, 4vw, 48px)",
                borderRadius: i === 0 ? "8px 0 0 0" : i === 2 ? "0 8px 0 0" : i === 3 ? "0 0 0 8px" : i === 5 ? "0 0 8px 0" : 0,
              }}
            >
              <div
                style={{
                  ...mn(10),
                  color: C.blue,
                  marginBottom: 32,
                  fontSize: 9,
                  letterSpacing: "0.3em",
                }}
              >
                0{i + 1}
              </div>
              <div
                style={{
                  ...cg("clamp(28px, 3vw, 44px)", 400),
                  color: C.cream,
                  marginBottom: 16,
                  lineHeight: 1.1,
                }}
              >
                {d.title}
              </div>
              <p style={{ ...it(14), color: "#6B6560", lineHeight: 1.6 }}>
                {d.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Projects */
function Projects() {
  const ref = useRef<HTMLElement>(null);
  useRevealChildren(ref as React.RefObject<HTMLElement>, ".proj-card", 0.1);

  return (
    <section
      ref={ref}
      style={{
        background: C.bg,
        padding: "clamp(80px, 10vw, 140px) clamp(24px, 6vw, 80px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 64,
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <div>
            <Label>Project Gallery · 2025 / 2026</Label>
            <h2 style={{ ...cg("clamp(40px, 5vw, 72px)", 400), color: C.ink }}>
              Real work.
              <br />
              <em style={{ fontWeight: 300, color: C.muted }}>Real nonprofits.</em>
            </h2>
          </div>
          <span style={{ ...mn(10), color: C.muted }}>20+ projects total →</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "clamp(12px, 2vw, 20px)",
          }}
        >
          {projects.map((p) => (
            <div
              key={p.name}
              className="proj-card"
              style={{
                opacity: 0,
                background: C.ink,
                borderRadius: 8,
                padding: "clamp(24px, 3vw, 36px)",
                cursor: "default",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 24px 48px rgba(0,0,0,0.24)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              {/* Org */}
              <span style={{ ...mn(9), color: C.blue, display: "block", marginBottom: 12 }}>
                {p.org}
              </span>
              {/* Project name */}
              <h3 style={{ ...cg("clamp(22px, 2.2vw, 30px)", 500), color: C.cream, marginBottom: 12 }}>
                {p.name}
              </h3>
              {/* Description */}
              <p style={{ ...it(13), color: "#6B6560", marginBottom: 20, lineHeight: 1.6 }}>
                {p.desc}
              </p>
              {/* Tags */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      ...mn(9),
                      color: "#5A5650",
                      border: "1px solid #2A2724",
                      padding: "4px 10px",
                      borderRadius: 2,
                    }}
                  >
                    {tag}
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

/* Testimonial */
function Testimonial() {
  const ref = useRef<HTMLElement>(null);
  const quoteRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = quoteRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 48 },
        {
          opacity: 1, y: 0, duration: 1.4, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 80%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.dark,
        padding: "clamp(100px, 14vw, 180px) clamp(24px, 8vw, 120px)",
        borderTop: "1px solid #1C1916",
      }}
    >
      <blockquote
        ref={quoteRef}
        style={{ opacity: 0, maxWidth: 900, margin: "0 auto" }}
      >
        <p
          style={{
            ...cg("clamp(32px, 4.5vw, 60px)", 400, true),
            color: C.cream,
            lineHeight: 1.25,
            marginBottom: 48,
          }}
        >
          &ldquo;Working with Tethos transformed how we serve our community. They didn&rsquo;t just build software — they took the time to understand our mission and delivered something we could actually sustain.&rdquo;
        </p>
        <footer style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 32, height: 1, background: C.blue }} />
          <div>
            <p style={{ ...mn(10, 700), color: C.cream, marginBottom: 4 }}>Maria Chen</p>
            <p style={{ ...mn(9), color: "#5A5650" }}>Executive Director · BrightAid Foundation</p>
          </div>
        </footer>
      </blockquote>
    </section>
  );
}

/* CTA */
function CTA() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref as React.RefObject<HTMLElement>);

  return (
    <section
      id="apply"
      ref={ref}
      style={{
        opacity: 0,
        background: C.bg,
        padding: "clamp(100px, 14vw, 180px) clamp(24px, 8vw, 120px)",
        textAlign: "center",
        borderTop: `1px solid ${C.rule}`,
      }}
    >
      <Label color={C.muted}>Applications Open</Label>
      <h2
        style={{
          ...cg("clamp(48px, 7vw, 100px)", 400),
          color: C.ink,
          marginBottom: "clamp(24px, 4vw, 40px)",
          lineHeight: 1.1,
        }}
      >
        Ready to transform
        <br />
        <em style={{ fontWeight: 300, color: C.muted }}>your organization?</em>
      </h2>
      <p
        style={{
          ...it(17),
          color: C.dim,
          maxWidth: 520,
          margin: "0 auto clamp(40px, 6vw, 64px)",
          lineHeight: 1.7,
        }}
      >
        Applications for the 2026 cohort are now open. Join the nonprofits
        already building with Tethos.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <a
          href="#"
          style={{
            ...mn(11, 700),
            color: C.cream,
            background: C.blue,
            padding: "18px 40px",
            borderRadius: 4,
            textDecoration: "none",
            letterSpacing: "0.15em",
            display: "inline-block",
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
        >
          Apply Now
        </a>
        <a
          href="#"
          style={{
            ...mn(11, 400),
            color: C.muted,
            border: `1px solid ${C.rule}`,
            padding: "18px 40px",
            borderRadius: 4,
            textDecoration: "none",
            letterSpacing: "0.15em",
            display: "inline-block",
            transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.borderColor = C.ink;
            el.style.color = C.ink;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.borderColor = C.rule;
            el.style.color = C.muted;
          }}
        >
          Download Package
        </a>
      </div>

      {/* Footer note */}
      <p
        style={{
          ...mn(9),
          color: "#C4C0BB",
          marginTop: "clamp(60px, 8vw, 100px)",
        }}
      >
        Tethos · Western University · Student Technology Initiative
      </p>
    </section>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function NPOTestPage() {
  return (
    <div
      className={`${cgFont.variable} ${interFont.variable} ${monoFont.variable}`}
      style={{ background: C.bg, overflowX: "hidden" }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width: 768px) {
          .process-row { grid-template-columns: 48px 1fr !important; }
          .process-row > *:nth-child(3) { grid-column: 1 / -1; }
          .process-row > *:nth-child(4) { display: none; }
          .del-card-grid { grid-template-columns: 1fr !important; }
          .proj-card-grid { grid-template-columns: 1fr !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <Hero />
      <Marquee />
      <Stats />
      <PullQuote />
      <Process />
      <Deliverables />
      <Projects />
      <Testimonial />
      <CTA />
    </div>
  );
}
