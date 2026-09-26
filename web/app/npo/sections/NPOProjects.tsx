"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const projects = [
  {
    name: "Donor Nexus",
    org: "BrightAid",
    desc: "Recurring giving portal with wallet pay and donor analytics.",
    tags: ["Next.js", "Stripe", "Postgres"],
  },
  {
    name: "Hearth",
    org: "ShelterNet",
    desc: "Privacy-safe case tracking with grant-ready exports.",
    tags: ["React", "Supabase", "Auth"],
  },
  {
    name: "Green Routes",
    org: "FoodBridge",
    desc: "Route batching, live ETAs, and volunteer mobile handoffs.",
    tags: ["Mapbox", "Node", "Redis"],
  },
  {
    name: "Pathways",
    org: "YouthRise",
    desc: "Mentor-mentee matching based on goals, time, and proximity.",
    tags: ["Next.js", "Postgres", "Clerk"],
  },
  {
    name: "Grant Glass",
    org: "GrantWorks",
    desc: "Milestone tracker with exportable narratives and budget rollups.",
    tags: ["Supabase", "React", "Tailwind"],
  },
  {
    name: "Pulse",
    org: "HealthConnect",
    desc: "Mobile-first intake with scoring and care-path suggestions.",
    tags: ["Next.js", "Zod", "Prisma"],
  },
];

export default function NPOProjects() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll(".proj-card"),
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1.0,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: el.querySelector(".proj-grid"),
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      style={{
        background: "#0F0F10",
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
            <span
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#5A5650",
                display: "block",
                marginBottom: 20,
              }}
            >
              Project Gallery / 2025–2026
            </span>
            <h2
              style={{
                fontFamily: "var(--font-heading), Georgia, serif",
                fontSize: "clamp(40px, 5vw, 72px)",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                color: "#F1FFFF",
              }}
            >
              Real work.
              <br />
              <em style={{ fontWeight: 300, color: "#71717A" }}>
                Real nonprofits.
              </em>
            </h2>
          </div>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#5A5650",
            }}
          >
            {projects.length} of 20+ projects
          </span>
        </div>

        <div
          className="proj-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "clamp(12px, 1.5vw, 16px)",
          }}
        >
          {projects.map((p, i) => (
            <div
              key={p.name}
              className="proj-card"
              style={{
                opacity: 0,
                background: "#1A1714",
                borderRadius: 6,
                overflow: "hidden",
                cursor: "default",
                transition:
                  "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow =
                  "0 32px 64px rgba(0,0,0,0.28)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Blue accent bar */}
              <div
                style={{ height: 3, background: "#002FA7", opacity: 0.6 }}
              />

              <div
                style={{ padding: "clamp(24px, 3vw, 36px)" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 9,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#002FA7",
                    }}
                  >
                    {p.org}
                  </span>
                  <span
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: 8,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#3A3632",
                    }}
                  >
                    0{i + 1}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: "var(--font-heading), Georgia, serif",
                    fontSize: "clamp(24px, 2.5vw, 32px)",
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    color: "#F5F2EB",
                    marginBottom: 12,
                  }}
                >
                  {p.name}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                    fontSize: 13,
                    fontWeight: 300,
                    color: "#6B6560",
                    marginBottom: 24,
                    lineHeight: 1.6,
                  }}
                >
                  {p.desc}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: 8,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "#5A5650",
                        border: "1px solid #2A2724",
                        padding: "3px 8px",
                        borderRadius: 2,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .proj-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
