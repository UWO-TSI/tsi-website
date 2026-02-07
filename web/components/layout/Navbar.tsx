"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Navbar() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const isHidden = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!headerRef.current) return;

    const threshold = 10; // minimum scroll delta before toggling

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      // Only act if we've scrolled past the threshold
      if (Math.abs(delta) < threshold) return;

      if (delta > 0 && !isHidden.current && currentY > 96) {
        // Scrolling DOWN — hide
        isHidden.current = true;
        gsap.to(headerRef.current, {
          y: "-100%",
          duration: 0.4,
          ease: "power3.out",
        });
      } else if (delta < 0 && isHidden.current) {
        // Scrolling UP — show
        isHidden.current = false;
        gsap.to(headerRef.current, {
          y: "0%",
          duration: 0.35,
          ease: "power3.out",
        });
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 h-[96px] will-change-transform"
    >
      <div className="flex h-full w-full items-center justify-between pl-[34px] pr-[34px]">
        {/* Left: logo */}
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-wide hover:opacity-80 transition-opacity"
        >
          TETHOS
        </Link>

        {/* Middle: pathways (desktop) */}
        <nav className="hidden gap-24 text-xs font-medium text-zinc-300 md:flex">
          <Link
            href="/npo"
            className={`transition-colors hover:text-white ${pathname === "/npo" ? "text-white" : ""}`}
          >
            Nonprofits
          </Link>
          <Link
            href="/company"
            className={`transition-colors hover:text-white ${pathname === "/company" ? "text-white" : ""}`}
          >
            Companies
          </Link>
          <Link
            href="/sponsor"
            className={`transition-colors hover:text-white ${pathname === "/sponsor" ? "text-white" : ""}`}
          >
            Sponsors
          </Link>
          <Link
            href="/student"
            className={`transition-colors hover:text-white ${pathname === "/student" ? "text-white" : ""}`}
          >
            Students
          </Link>
        </nav>

        {/* Right: actions (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-3 text-xs">
          <button className="hidden md:block text-zinc-300 transition-colors hover:text-white">
            Contact
          </button>
          <button className="hidden md:block rounded-full bg-[#002FA7] px-4 py-2 text-[11px] font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
            Apply
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span
              className={`block w-5 h-[1.5px] bg-white transition-transform duration-300 ${mobileOpen ? "translate-y-[6.5px] rotate-45" : ""}`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-white transition-opacity duration-300 ${mobileOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-5 h-[1.5px] bg-white transition-transform duration-300 ${mobileOpen ? "-translate-y-[6.5px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-[96px] inset-x-0 bg-[#0F0F10]/95 backdrop-blur-md border-t border-white/10 px-8 py-6 flex flex-col gap-5 text-sm font-medium text-zinc-300">
          <Link href="/npo" className="hover:text-white transition-colors">
            Nonprofits
          </Link>
          <Link href="/company" className="hover:text-white transition-colors">
            Companies
          </Link>
          <Link href="/sponsor" className="hover:text-white transition-colors">
            Sponsors
          </Link>
          <Link href="/student" className="hover:text-white transition-colors">
            Students
          </Link>
          <hr className="border-white/10" />
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
          <button className="rounded-full bg-[#002FA7] px-4 py-2 text-[11px] font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC] w-fit">
            Apply
          </button>
        </div>
      )}
    </header>
  );
}
