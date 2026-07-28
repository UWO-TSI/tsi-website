import { notFound } from "next/navigation";
import Link from "next/link";

/**
 * /lab — the separated local testing unit (David ask, 2026-07-22).
 *
 * Dev-only: production builds 404 every lab route (and the assets API),
 * so none of this ever reaches tethos.ca. Successor to the ad-hoc
 * water-harness/*.html replicas — these benches mount the REAL game
 * components, so there's no replica drift between lab and game.
 */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#0b0e14", color: "#f1ffff" }}>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 40,
          padding: "0 16px",
          background: "rgba(11, 14, 20, 0.92)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#FFD166", letterSpacing: "0.12em" }}>TSI LAB</span>
        <Link href="/lab" style={{ color: "#c9d1d6" }}>Index</Link>
        <Link href="/lab/world" style={{ color: "#c9d1d6" }}>World bench</Link>
        <Link href="/lab/fishing" style={{ color: "#c9d1d6" }}>Fishing bench</Link>
        <Link href="/lab/item" style={{ color: "#c9d1d6" }}>Item bench</Link>
        <Link href="/lab/interior" style={{ color: "#c9d1d6" }}>Interior bench</Link>
        <Link href="/lab/furniture" style={{ color: "#c9d1d6" }}>Furniture bench</Link>
        <Link href="/lab/tune" style={{ color: "#FFD166" }}>Tuning bench</Link>
        <span style={{ marginLeft: "auto", color: "#8a939a" }}>dev-only · 404 in production</span>
      </nav>
      <div style={{ paddingTop: 40 }}>{children}</div>
    </div>
  );
}
