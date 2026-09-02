"use client";

const row1Items = [
  "Pro-bono",
  "Production-ready",
  "No cost",
  "Real impact",
  "20+ projects",
  "Discovery to deployment",
];

const row2Items = [
  "Built by students",
  "8 months",
  "For nonprofits",
  "Western University",
];

export default function NPOMarquee() {
  const doubled1 = [...row1Items, ...row1Items];
  const doubled2 = [...row2Items, ...row2Items];

  return (
    <>
      <style jsx>{`
        @keyframes marquee-l {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes marquee-r {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .marquee-left { animation: marquee-l 30s linear infinite; }
        .marquee-right { animation: marquee-r 30s linear infinite; }
      `}</style>
      <section
        data-navbar-theme="dark"
        style={{
          background: "#0F0F10",
          overflow: "hidden",
          paddingBlock: 20,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Row 1 — left scroll, heading font italic */}
        <div
          className="marquee-left"
          style={{ display: "flex", width: "max-content", marginBottom: 8 }}
        >
          {doubled1.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-heading), Georgia, serif",
                fontSize: 20,
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--color-text-soft, #A1A1AA)",
                padding: "0 clamp(24px, 4vw, 56px)",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "clamp(24px, 4vw, 56px)",
              }}
            >
              {item}
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--color-brand-yellow, #C4956A)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            </span>
          ))}
        </div>
        {/* Row 2 — right scroll, mono */}
        <div
          className="marquee-right"
          style={{ display: "flex", width: "max-content" }}
        >
          {doubled2.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 10,
                fontWeight: 400,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--color-text-muted, #71717A)",
                padding: "0 clamp(24px, 4vw, 56px)",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "clamp(24px, 4vw, 56px)",
              }}
            >
              {item}
              <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
