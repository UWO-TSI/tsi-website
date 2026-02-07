"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * A light-themed variant of the main Navbar for the white Sponsor page.
 * Auto-hides on scroll down, reappears on scroll up.
 */
export default function SponsorNavbar() {
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const isHidden = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!headerRef.current) return;
    const threshold = 10;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (Math.abs(delta) < threshold) return;

      if (delta > 0 && !isHidden.current && currentY > 96) {
        isHidden.current = true;
        gsap.to(headerRef.current, { y: "-100%", duration: 0.4, ease: "power3.out" });
      } else if (delta < 0 && isHidden.current) {
        isHidden.current = false;
        gsap.to(headerRef.current, { y: "0%", duration: 0.35, ease: "power3.out" });
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 h-[96px] bg-white/80 backdrop-blur-md border-b border-gray-100 will-change-transform"
    >
      <div className="flex h-full w-full items-center justify-between px-[34px]">
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-wide text-gray-900 hover:opacity-80 transition-opacity"
        >
          TETHOS
        </Link>

        <nav className="hidden gap-24 text-xs font-medium text-gray-400 md:flex">
          <Link href="/npo" className="transition-colors hover:text-gray-900">
            Nonprofits
          </Link>
          <Link href="/company" className="transition-colors hover:text-gray-900">
            Companies
          </Link>
          <Link href="/sponsor" className="text-gray-900">
            Sponsors
          </Link>
          <Link href="/student" className="transition-colors hover:text-gray-900">
            Students
          </Link>
        </nav>

        <div className="flex items-center gap-3 text-xs">
          <button className="hidden md:block text-gray-500 transition-colors hover:text-gray-900">
            Contact
          </button>
          <button className="hidden md:block rounded-full bg-gray-900 px-4 py-2 text-[11px] font-medium text-white transition-all hover:bg-gray-800">
            Become a Sponsor
          </button>
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-[1.5px] bg-gray-900 transition-transform duration-300 ${mobileOpen ? "translate-y-[6.5px] rotate-45" : ""}`} />
            <span className={`block w-5 h-[1.5px] bg-gray-900 transition-opacity duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-[1.5px] bg-gray-900 transition-transform duration-300 ${mobileOpen ? "-translate-y-[6.5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden absolute top-[96px] inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-8 py-6 flex flex-col gap-5 text-sm font-medium text-gray-500">
          <Link href="/npo" className="hover:text-gray-900 transition-colors">Nonprofits</Link>
          <Link href="/company" className="hover:text-gray-900 transition-colors">Companies</Link>
          <Link href="/sponsor" className="text-gray-900">Sponsors</Link>
          <Link href="/student" className="hover:text-gray-900 transition-colors">Students</Link>
        </div>
      )}
    </header>
  );
}
