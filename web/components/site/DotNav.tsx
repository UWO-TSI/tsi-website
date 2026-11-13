"use client";

import { useEffect, useState } from "react";

export type DotSection = { id: string; label: string };

/** The column of dots on the right edge, one per section; labels show on hover. Inverts against any ground. */
export default function DotNav({ sections }: { sections: DotSection[] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(sections.findIndex((s) => s.id === e.target.id));
    }, { rootMargin: "-45% 0px -55% 0px" });
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [sections]);

  return (
    <nav
      aria-label="Sections"
      style={{ position: "fixed", right: 18, top: "50%", transform: "translateY(-50%)", zIndex: 58, display: "flex", flexDirection: "column", gap: 12, mixBlendMode: "difference", opacity: shown ? 1 : 0, transition: "opacity 0.4s", pointerEvents: shown ? "auto" : "none" }}
      className="ts-dotnav"
    >
      {sections.map((s, i) => (
        <a key={s.id} href={`#${s.id}`} aria-label={s.label} aria-current={i === active ? "true" : undefined} className="ts-dotnav__item" style={{ position: "relative", display: "grid", placeItems: "center", width: 24, height: 24, margin: "-9px -9px -9px 0", color: "#fff" }}>
          <span className="ts-dotnav__label" style={{ position: "absolute", right: "100%", top: "50%", marginTop: -7, whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</span>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", opacity: i === active ? 1 : 0.35, transform: i === active ? "scale(1.4)" : "none", transition: "opacity 0.3s, transform 0.3s" }} />
        </a>
      ))}
      <style>{`.ts-dotnav__label{opacity:0;transform:translateX(4px);transition:opacity .25s,transform .25s}.ts-dotnav__item:hover .ts-dotnav__label,.ts-dotnav__item:focus-visible .ts-dotnav__label{opacity:1;transform:none}@media (max-width:820px),(hover:none){.ts-dotnav{display:none!important}}`}</style>
    </nav>
  );
}
