"use client";

import Link from "next/link";
import { useCallback } from "react";

const linkClass =
  "transition-colors hover:text-white focus:outline-none focus-visible:text-white";

export default function CompanyNavbar() {
  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    const yOffset = -96; // navbar height
    const y =
      element.getBoundingClientRect().top +
      window.pageYOffset +
      yOffset;

    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const handleNavClick = (id: string) => {
    scrollToSection(id);
    window.history.pushState(null, "", `#${id}`);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[96px] bg-[#0F0F10]/80 backdrop-blur">
      <div className="flex h-full w-full items-center justify-between px-[34px]">
        {/* Left: logo */}
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-wide hover:opacity-80 transition-opacity"
        >
          TETHOS
        </Link>

        {/* Middle: company sections (single-page scroll) */}
        <nav
          aria-label="Company sections"
          className="hidden gap-24 text-xs font-medium text-zinc-300 md:flex"
        >
          <button onClick={() => handleNavClick("build")} className={linkClass}>
            Build
          </button>
          <button onClick={() => handleNavClick("work")} className={linkClass}>
            Work
          </button>
          <button onClick={() => handleNavClick("talent")} className={linkClass}>
            Talent
          </button>
          <button onClick={() => handleNavClick("team")} className={linkClass}>
            Team
          </button>
          <button onClick={() => handleNavClick("faqs")} className={linkClass}>
            FAQs
          </button>
          <button
            onClick={() => handleNavClick("get-started")}
            className={linkClass}
          >
            Get Started
          </button>
        </nav>

        {/* Right: Company Pathway */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-heading text-sm font-semibold tracking-wide text-zinc-300">
            Company Pathway
          </span>
        </div>
      </div>
    </header>
  );
}