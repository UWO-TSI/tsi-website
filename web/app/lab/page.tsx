import Link from "next/link";

const CARDS = [
  {
    href: "/lab/world",
    title: "World bench",
    desc: "The real island with experiment knobs: scrub time of day (skies), force weather, override the seasonal palette live, drive the pastel-grade uniforms, spawn presets. Try a look here, screenshot it, get the verdict, bake the values into the game.",
  },
  {
    href: "/lab/item",
    title: "Item bench",
    desc: "Isolated GLB inspector for the asset dump: browse every .glb under public/, orbit + top-down (catches sideways skin-bakes), player-height reference for scale, bounding-box + material readout.",
  },
] as const;

export default function LabIndex() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", fontFamily: "'IBM Plex Mono', monospace" }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>TSI Lab</h1>
      <p style={{ fontSize: 12, color: "#8a939a", marginBottom: 28, lineHeight: 1.6 }}>
        Separated local testing unit for experimental skies, palettes, grading, and assets.
        Everything here mounts the real game code — values proven on a bench get baked into
        the game in a normal commit. Dev-only; production 404s all of it.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{
              display: "block",
              padding: "18px 20px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              color: "#f1ffff",
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#c9d1d6", lineHeight: 1.6 }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
