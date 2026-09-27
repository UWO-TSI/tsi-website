import type { Metadata } from "next";
import Link from "next/link";
import { APPLICANT_PORTAL } from "@/lib/recruitment-access";

export const metadata: Metadata = { title: "Opening soon" };

// Where member-world links land while NEXT_PUBLIC_MEMBER_WORLD is closed.
const button = { display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: "none" } as const;

export default function OpeningSoon() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "96px 16px 48px", background: "#0F0F10" }}>
      <section style={{ maxWidth: 440, padding: "36px 32px", borderRadius: "18px 18px 6px 18px", background: "#f8f7e9", color: "#293e3b", boxShadow: "0 8px 0 #47625230, 0 18px 48px #0006", fontFamily: "var(--font-highlight), monospace" }}>
        <p style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#5b7a6c" }}>Tethos Island</p>
        <h1 style={{ margin: "10px 0 12px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em" }}>Opening soon</h1>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          The member island is getting its last coat of paint. The gates open to the club shortly, so check back soon.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
          <Link href="/" style={{ ...button, background: "#426b5b", color: "#fffdf0" }}>Back to tethos.ca</Link>
          <Link href={APPLICANT_PORTAL} style={{ ...button, border: "1px solid #94a796", color: "#293e3b" }}>Applicant portal</Link>
        </div>
      </section>
    </main>
  );
}
