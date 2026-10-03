import type { Metadata } from "next";
import Link from "next/link";
import { APPLICANT_PORTAL } from "@/lib/recruitment-access";

export const metadata: Metadata = { title: "Opening soon" };

// Where member-world links land while NEXT_PUBLIC_MEMBER_WORLD is closed: a paper notice in the GUI sheet (row 285).
const button = { display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 20px", borderRadius: 999, fontSize: "var(--gui-text-sm)", fontWeight: 800, textDecoration: "none" } as const;

export default function OpeningSoon() {
  return (
    <main className="gui" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "96px 16px 48px", background: "var(--gui-confetti) var(--gui-page)" }}>
      <section style={{ position: "relative", maxWidth: 460, padding: "40px 34px 32px", borderRadius: "var(--gui-r-paper)", background: "var(--gui-grain) var(--gui-paper)", color: "var(--gui-ink)", boxShadow: "var(--gui-shadow-lg)" }}>
        <span aria-hidden="true" style={{ position: "absolute", top: 14, left: "calc(50% - 7px)", width: 14, height: 14, borderRadius: "50%", background: "var(--gui-sage)", boxShadow: "inset 2px 2px 0 #8fb9a6, 1px 2px 1px rgb(104 79 54 / 0.3)" }} />
        <p style={{ margin: 0, fontSize: "var(--gui-text-xs)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gui-muted)" }}>Tethos Island</p>
        <h1 style={{ margin: "8px 0 12px", fontSize: "var(--gui-text-2xl)", fontWeight: 900, color: "var(--gui-ink-strong)" }}>Opening soon</h1>
        <p style={{ margin: 0, fontSize: "var(--gui-text-md)", lineHeight: 1.6 }}>
          The member island is getting its last coat of paint. The gates open to the club shortly, so check back soon.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
          <Link href="/" style={{ ...button, background: "var(--gui-sage)", color: "var(--gui-paper)", boxShadow: "0 3px 0 var(--gui-sage-deep)" }}>Back to tethos.ca</Link>
          <Link href={APPLICANT_PORTAL} style={{ ...button, background: "var(--gui-paper-hi)", color: "var(--gui-ink)", boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)" }}>Applicant portal</Link>
        </div>
      </section>
    </main>
  );
}
