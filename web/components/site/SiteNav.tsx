"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TsiLogo from "@/components/ui/TsiLogo";
import { PLAY_ORIGIN } from "@/lib/hosts";
import { YEAR } from "@/lib/site/config";
import type { SeasonCta } from "@/lib/site/season";

const LINKS = [
  { label: "Nonprofits", href: "/npo" },
  { label: "GENESIS", href: "/genesis" },
  { label: "Students", href: "/student/apply" },
];

/** The tone of the section under the nav's middle, so the pill stays readable over light grounds. */
function useToneUnder(ref: React.RefObject<HTMLElement | null>) {
  const [tone, setTone] = useState<"dark" | "light">("dark");
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const nav = ref.current;
      if (!nav) return;
      const box = nav.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const under = document.elementsFromPoint(window.innerWidth / 2, y).find((el) => !nav.contains(el) && el.closest("[data-tone]"));
      const next = under?.closest("[data-tone]")?.getAttribute("data-tone") === "light" ? "light" : "dark";
      setTone((t) => (t === next ? t : next));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [ref]);
  return tone;
}

/**
 * Compact (a "dynamic island") once the page has scrolled and the reader is scrolling down; full again on
 * scroll up, hover or keyboard focus.
 */
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY, frame = 0;
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < 120) setCompact(false);
      else if (y > last + 4) setCompact(true);
      else if (y < last - 12) setCompact(false);
      last = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return compact;
}

export default function SiteNav({ cta, contact }: { cta: SeasonCta; contact: string }) {
  const navRef = useRef<HTMLElement>(null);
  const tone = useToneUnder(navRef);
  const scrolledCompact = useCompact();
  const [held, setHeld] = useState(false);
  const compact = scrolledCompact && !held;
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.documentElement.style.overflow = ""; };
  }, [open]);

  const strip = YEAR.map((d) => (
    <span key={d.title}><b>{d.when}</b>&nbsp;&nbsp;{d.title}</span>
  ));

  return (
    <>
      <header
        ref={navRef}
        className="ts-nav"
        data-tone={tone}
        data-compact={compact}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHeld(false); }}
      >
        <div className="ts-nav__bar">
          <Link href="/" className="ts-nav__logo" aria-label="Tethos home">
            <TsiLogo width={22} height={22} />
          </Link>
          <div className="ts-nav__links-wrap">
          <nav className="ts-nav__links" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="ts-nav__link" aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
            ))}
            <a href={`mailto:${contact}`} className="ts-nav__link">Contact</a>
            <a href={`${PLAY_ORIGIN}/`} className="ts-nav__link ts-nav__link--quiet">Student portal ↗</a>
          </nav>
          </div>
          <div className="ts-nav__right">
            <Link href={cta.href} className="ts-btn ts-btn--primary" data-cta={cta.kind}>{cta.label}</Link>
            <button type="button" className="ts-nav__menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <span />
            </button>
          </div>
        </div>
        <div className="ts-nav__strip" aria-label="This year's dates">
          <div className="ts-nav__track">{strip}{strip}</div>
        </div>
      </header>

      <div className="ts-sheet" data-open={open} inert={!open} role="dialog" aria-modal="true" aria-label="Menu">
        <button type="button" className="ts-btn ts-btn--ghost ts-sheet__close" onClick={() => setOpen(false)}>Close</button>
        {LINKS.map((l, i) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="ts-sheet__link" style={{ transitionDelay: open ? `${0.07 + i * 0.07}s` : "0s" }}>{l.label}</Link>
        ))}
        <a href={`mailto:${contact}`} className="ts-sheet__link" style={{ transitionDelay: open ? "0.28s" : "0s" }}>Contact</a>
        <div className="ts-sheet__foot">
          <Link href={cta.href} onClick={() => setOpen(false)} className="ts-btn ts-btn--primary" style={{ alignSelf: "flex-start" }}>{cta.label}</Link>
          <a href={`${PLAY_ORIGIN}/`} className="ts-dim" style={{ fontSize: 14 }}>Student portal ↗</a>
        </div>
      </div>
    </>
  );
}
