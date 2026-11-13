"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CoinHandIcon, EnvelopeIcon, HeartIcon, PersonIcon, SparkIcon } from "@/components/site/icons";
import TsiLogo from "@/components/ui/TsiLogo";
import type { SeasonCta } from "@/lib/site/season";

const LINKS = [
  { label: "Nonprofits", href: "/npo", Icon: HeartIcon },
  { label: "GENESIS", href: "/genesis", Icon: SparkIcon },
  { label: "Students", href: "/students", Icon: PersonIcon },
];

/** The button takes the icon of whoever the season is calling. */
const CTA_ICON = { sponsors: CoinHandIcon, nonprofits: HeartIcon, students: PersonIcon } as const;

/** What the strip under the full nav scrolls. */
const STRIP = { label: "Sponsor GENESIS", when: "March 2027", href: "/genesis" };

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
    // At most ten times a second: asking what is under the nav makes the browser settle its layout first.
    const onScroll = () => { if (!frame) frame = window.setTimeout(check, 100); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (frame) clearTimeout(frame); };
  }, [ref]);
  return tone;
}

/**
 * Compact (a "dynamic island" of icons) once the page has scrolled and the reader is scrolling down;
 * full again on scroll up or near the top.
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

export default function SiteNav({ cta }: { cta: SeasonCta }) {
  const navRef = useRef<HTMLElement>(null);
  const tone = useToneUnder(navRef);
  const compact = useCompact();
  // The squash only plays once the island has moved, never on load.
  const [moved, setMoved] = useState(false);
  if (compact && !moved) setMoved(true);
  const [tip, setTip] = useState<{ label: string; x: number } | null>(null);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const CtaIcon = CTA_ICON[cta.kind];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.documentElement.style.overflow = ""; };
  }, [open]);

  /** The label under the island glides to whichever icon is hovered or focused. */
  const showTip = (label: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;
    const a = e.currentTarget.getBoundingClientRect(), b = nav.getBoundingClientRect();
    setTip({ label, x: a.left - b.left + a.width / 2 });
  };
  const tipProps = (label: string) => ({ "aria-label": label, onPointerEnter: showTip(label), onFocus: showTip(label), onPointerLeave: () => setTip(null), onBlur: () => setTip(null) });

  const strip = Array.from({ length: 4 }, (_, i) => (
    <span key={i}>{STRIP.label}<b>{STRIP.when}</b></span>
  ));

  return (
    <>
      <header ref={navRef} className="ts-nav" data-tone={tone} data-compact={compact} data-moved={moved || undefined}>
        <div className="ts-nav__bar">
          <Link href="/" className="ts-nav__logo" aria-label="Tethos home">
            <TsiLogo width={22} height={22} />
          </Link>
          <div className="ts-nav__links-wrap" inert={compact}>
            <nav className="ts-nav__links" aria-label="Main">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="ts-nav__link" aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
              ))}
              <Link href="/contact" className="ts-nav__link" aria-current={path === "/contact" ? "page" : undefined}>Contact</Link>
            </nav>
          </div>
          <div className="ts-nav__icons-wrap" inert={!compact}>
            <nav className="ts-nav__icons" aria-label="Main">
              {LINKS.map((l, i) => (
                <Link key={l.href} href={l.href} className="ts-nav__icon" style={{ "--i": i } as React.CSSProperties} aria-current={path === l.href ? "page" : undefined} {...tipProps(l.label)}>
                  <l.Icon size={16} />
                </Link>
              ))}
              <Link href="/contact" className="ts-nav__icon" style={{ "--i": 3 } as React.CSSProperties} {...tipProps("Contact")}>
                <EnvelopeIcon size={16} />
              </Link>
            </nav>
          </div>
          <div className="ts-nav__right">
            <Link href={cta.href} className="ts-btn ts-btn--primary ts-nav__cta" data-cta={cta.kind} aria-label={cta.label}
              onPointerEnter={compact ? showTip(cta.label) : undefined} onPointerLeave={() => setTip(null)}>
              <span className="ts-nav__cta-icon" aria-hidden="true"><CtaIcon size={15} /></span>
              <span className="ts-nav__cta-label">{cta.label}</span>
            </Link>
            <button type="button" className="ts-nav__menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <span />
            </button>
          </div>
        </div>
        <Link href={STRIP.href} className="ts-nav__strip" aria-label={`${STRIP.label}, ${STRIP.when}`} inert={compact}>
          <div className="ts-nav__track" aria-hidden="true">{strip}{strip}</div>
        </Link>
        <span className="ts-nav__tip" data-show={compact && !!tip} style={{ "--x": `${tip?.x ?? 0}px` } as React.CSSProperties} aria-hidden="true">{tip?.label}</span>
      </header>

      <div className="ts-sheet" data-open={open} inert={!open} role="dialog" aria-modal="true" aria-label="Menu">
        <button type="button" className="ts-btn ts-btn--ghost ts-sheet__close" onClick={() => setOpen(false)}>Close</button>
        {LINKS.map((l, i) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="ts-sheet__link" style={{ transitionDelay: open ? `${0.07 + i * 0.07}s` : "0s" }}>{l.label}</Link>
        ))}
        <Link href="/contact" className="ts-sheet__link" style={{ transitionDelay: open ? "0.28s" : "0s" }}>Contact</Link>
        <div className="ts-sheet__foot">
          <Link href={cta.href} onClick={() => setOpen(false)} className="ts-btn ts-btn--primary" style={{ alignSelf: "flex-start" }}>{cta.label}</Link>
        </div>
      </div>
    </>
  );
}
