"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const processSteps = [
  {
    num: "01",
    phase: "Application",
    duration: "2 weeks",
    desc: "Nonprofits submit a brief application describing their mission and technical needs. We select based on impact potential and feasibility.",
  },
  {
    num: "02",
    phase: "Discovery",
    duration: "3 weeks",
    desc: "We embed with your team. Stakeholder interviews, workflow mapping, and requirements gathering produce a single clear project brief.",
  },
  {
    num: "03",
    phase: "Design",
    duration: "4 weeks",
    desc: "Information architecture, wireframes, and a high-fidelity prototype. You iterate until the solution feels native to your organization.",
  },
  {
    num: "04",
    phase: "Development",
    duration: "16 weeks",
    desc: "Sprint-based engineering with biweekly demos. Working software ships early. You steer direction throughout.",
  },
  {
    num: "05",
    phase: "Handoff",
    duration: "3 weeks",
    desc: "Production deployment, staff training, technical documentation, and 30 days of post-launch support. No strings attached.",
  },
];

/* CSS-only artifact mockups for each phase */
function ProcessArtifact({ phase }: { phase: string }) {
  if (phase === "01") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 20,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          width: 200,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#71717A" }}>
            Organization name
          </span>
          <div
            style={{
              height: 28,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              paddingInline: 8,
            }}
          >
            <div
              style={{
                height: 8,
                width: 96,
                borderRadius: 4,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#71717A" }}>
            Mission statement
          </span>
          <div
            style={{
              height: 28,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              paddingInline: 8,
            }}
          >
            <div
              style={{
                height: 8,
                width: 64,
                borderRadius: 4,
                background: "rgba(255,255,255,0.08)",
              }}
            />
          </div>
        </div>
        <button
          style={{
            marginTop: 4,
            height: 32,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            color: "white",
            background: "#002FA7",
            border: "none",
            cursor: "default",
          }}
        >
          Submit Application
        </button>
      </div>
    );
  }
  if (phase === "02") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          padding: 8,
          width: 200,
        }}
      >
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
            style={{
              height: 56,
              borderRadius: 2,
              padding: 6,
              display: "flex",
              alignItems: "flex-start",
              fontSize: 9,
              fontWeight: 500,
              color: "#0F0F10",
              background: note.bg,
              transform: `rotate(${note.rot})`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            }}
          >
            {note.text}
          </div>
        ))}
      </div>
    );
  }
  if (phase === "03") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          width: 200,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {["#002FA7", "#0039CC", "#F1FFFF", "#0F0F10", "#A1A1AA"].map(
            (c) => (
              <div
                key={c}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: c,
                }}
              />
            )
          )}
        </div>
        <div
          style={{ height: 1, background: "rgba(255,255,255,0.06)" }}
        />
        <div
          style={{
            borderRadius: 6,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              height: 8,
              width: 40,
              borderRadius: 4,
              background: "rgba(255,255,255,0.1)",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: 6,
                  width: 24,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (phase === "04") {
    return (
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #30363D",
          background: "#0D1117",
          width: 220,
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderBottom: "1px solid #30363D",
            background: "#161B22",
          }}
        >
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div
              key={c}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: c,
              }}
            />
          ))}
        </div>
        <pre
          style={{
            fontSize: 9,
            lineHeight: 1.7,
            padding: 12,
            color: "#C9D1D9",
            margin: 0,
          }}
        >
          <span style={{ color: "#79C0FF" }}>async</span>{" "}
          <span style={{ color: "#D2A8FF" }}>function</span>{" "}
          <span style={{ color: "#FFA657" }}>fetchDonors</span>
          {"() {\n"}
          {"  "}
          <span style={{ color: "#79C0FF" }}>const</span>
          {" data =\n"}
          {"    "}
          <span style={{ color: "#79C0FF" }}>await</span>
          {" api\n"}
          {"      .donors()\n"}
          {"      .filter(\n"}
          {"        active: "}
          <span style={{ color: "#79C0FF" }}>true</span>
          {"\n      );\n"}
          {"  "}
          <span style={{ color: "#79C0FF" }}>return</span>
          {" data;\n}"}
        </pre>
      </div>
    );
  }
  if (phase === "05") {
    return (
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.03)",
          width: 220,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <div
                key={c}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: c,
                }}
              />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              height: 16,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              paddingInline: 8,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span style={{ fontSize: 8, color: "#71717A" }}>
              yournonprofit.org
            </span>
          </div>
        </div>
        <div
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              height: 64,
              borderRadius: 6,
              background: "#002FA7",
              opacity: 0.8,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                height: 32,
                flex: 1,
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
              }}
            />
            <div
              style={{
                height: 32,
                flex: 1,
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function NPOProcess() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const ctx = gsap.context(() => {
      const totalWidth = track.scrollWidth;
      const viewWidth = window.innerWidth;

      gsap.to(track, {
        x: -(totalWidth - viewWidth),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${totalWidth - viewWidth}`,
          pin: true,
          scrub: 1.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-navbar-theme="dark"
      style={{
        overflow: "hidden",
        background: "#0F0F10",
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: "flex",
          width: "fit-content",
          minHeight: "100vh",
          willChange: "transform",
        }}
      >
        {/* Intro panel */}
        <div
          style={{
            minWidth: "clamp(400px, 45vw, 600px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "clamp(40px, 6vw, 100px)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
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
            The Process
          </span>
          <h2
            style={{
              fontFamily: "var(--font-heading), Georgia, serif",
              fontSize: "clamp(48px, 6vw, 88px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "#F1FFFF",
              marginBottom: 24,
            }}
          >
            Five phases.
            <br />
            <em style={{ fontWeight: 300, color: "#71717A" }}>
              One outcome.
            </em>
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 300,
              color: "#A1A1AA",
              maxWidth: 360,
              lineHeight: 1.65,
            }}
          >
            Every engagement follows the same rigorous framework. Scroll
            to explore each phase.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 40,
            }}
          >
            <span
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#5A5650",
              }}
            >
              Scroll →
            </span>
            <div
              style={{
                width: 40,
                height: 1,
                background: "rgba(255,255,255,0.1)",
              }}
            />
          </div>
        </div>

        {/* Process panels */}
        {processSteps.map((step, i) => (
          <div
            key={step.num}
            className="process-panel"
            style={{
              minWidth: "clamp(360px, 40vw, 520px)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "clamp(40px, 6vw, 80px)",
              borderRight:
                i < processSteps.length - 1
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "none",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Giant background number */}
            <div
              style={{
                position: "absolute",
                bottom: -20,
                right: -10,
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: "clamp(160px, 20vw, 280px)",
                fontWeight: 700,
                color: "rgba(255,255,255,0.03)",
                lineHeight: 1,
                userSelect: "none",
                pointerEvents: "none",
                letterSpacing: "-0.05em",
              }}
            >
              {step.num}
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <span
                style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#002FA7",
                  display: "block",
                  marginBottom: 32,
                }}
              >
                Phase {step.num}
              </span>
              <h3
                style={{
                  fontFamily: "var(--font-heading), Georgia, serif",
                  fontSize: "clamp(36px, 4vw, 56px)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                  color: "#F1FFFF",
                  marginBottom: 16,
                }}
              >
                {step.phase}
              </h3>
              <span
                style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--color-brand-yellow, #C4956A)",
                  display: "block",
                  marginBottom: 24,
                }}
              >
                Duration: {step.duration}
              </span>
              <p
                style={{
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                  fontSize: 15,
                  fontWeight: 300,
                  color: "#A1A1AA",
                  lineHeight: 1.7,
                  maxWidth: 340,
                }}
              >
                {step.desc}
              </p>

              {/* CSS artifact */}
              <div style={{ marginTop: 32 }} className="hidden md:block">
                <ProcessArtifact phase={step.num} />
              </div>

              {/* Progress pips */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 48,
                }}
              >
                {processSteps.map((_, j) => (
                  <div
                    key={j}
                    style={{
                      width: j === i ? 32 : 8,
                      height: 3,
                      borderRadius: 2,
                      background:
                        j === i ? "#002FA7" : "rgba(255,255,255,0.1)",
                      transition: "width 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
