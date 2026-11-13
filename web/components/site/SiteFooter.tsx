import Link from "next/link";
import TsiLogo from "@/components/ui/TsiLogo";
import type { SiteConfig } from "@/lib/site/config";

export default function SiteFooter({ site }: { site: SiteConfig }) {
  return (
    <footer className="ts-footer" data-tone="light">
      <div className="ts-wrap">
        <div className="ts-footer__row">
          <Link href="/" aria-label="Tethos home" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--on-light)" }}>
            <TsiLogo width={28} height={28} />
            <span style={{ fontWeight: 500, letterSpacing: "-0.01em" }}>Tethos</span>
          </Link>
          <nav className="ts-footer__links" aria-label="Footer">
            <Link href="/npo">Nonprofits</Link>
            <Link href="/genesis">GENESIS</Link>
            <Link href="/students">Students</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
        <div className="ts-footer__small">
          <span>Start a branch at your school: <a href={`mailto:${site.contact}?subject=Starting%20a%20Tethos%20branch`}>{site.contact}</a></span>
          <span>
            <a href={site.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
            {" · "}
            <a href={site.github} target="_blank" rel="noopener noreferrer">GitHub</a>
            {" · "}<span style={{ whiteSpace: "nowrap" }}>© {new Date().getFullYear()} Tethos Association</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
