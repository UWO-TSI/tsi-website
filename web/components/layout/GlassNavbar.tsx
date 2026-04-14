"use client";

import Image from "next/image";
import Link from "next/link";
import TsiLogo from "@/components/ui/TsiLogo";
import { usePathname } from "next/navigation";
import { type FocusEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NavDropdownItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface NavColumn {
  heading: string;
  href: string;
  items: NavDropdownItem[];
}

export interface GlassNavbarProps {
  /** Columns rendered in the glass extension dropdown */
  columns?: NavColumn[];
  /** Extra utility links shown as the last dropdown column */
  extraLinks?: NavDropdownItem[];
  /** Right-side CTA label (default "Contact") */
  ctaLabel?: string;
  /** Right-side CTA href */
  ctaHref?: string;
}

/* ------------------------------------------------------------------ */
/*  Defaults (placeholder)                                             */
/* ------------------------------------------------------------------ */

const DEFAULT_COLUMNS: NavColumn[] = [
  {
    heading: "Nonprofits",
    href: "/npo",
    items: [
      { label: "Apply", href: "#" },
      { label: "Program", href: "#" },
      { label: "Impact", href: "#" },
      { label: "People", href: "#" },
      { label: "Voices", href: "#" },
    ],
  },
  {
    heading: "Companies",
    href: "/company",
    items: [
      { label: "Recruit", href: "#" },
      { label: "Services", href: "#" },
      { label: "Outcomes", href: "#" },
      { label: "Talent", href: "#" },
      { label: "Proof", href: "#" },
    ],
  },
  {
    heading: "Sponsors",
    href: "/sponsor",
    items: [
      { label: "Genesis", href: "#" },
      { label: "Package", href: "#" },
      { label: "Impact", href: "#" },
      { label: "Partners", href: "#" },
      { label: "Trust", href: "#" },
    ],
  },
  {
    heading: "Students",
    href: "/student",
    items: [
      { label: "Init", href: "#" },
      { label: "System", href: "#" },
      { label: "Nodes", href: "#" },
      { label: "Logs", href: "#" },
    ],
  },
];

const DEFAULT_EXTRA_LINKS: NavDropdownItem[] = [
  { label: "Log in", href: "#" },
  { label: "Linkedin", href: "#", external: true },
  { label: "Instagram", href: "#", external: true },
  { label: "Bug", href: "#" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GlassNavbar({
  columns = DEFAULT_COLUMNS,
  extraLinks = DEFAULT_EXTRA_LINKS,
  ctaLabel = "Contact",
  ctaHref = "/contact",
}: GlassNavbarProps) {
  const pathname = usePathname();
  const dropdownId = useId();
  const mobileMenuId = useId();

  /* Refs ----------------------------------------------------------- */
  const headerRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const isHidden = useRef(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* State ---------------------------------------------------------- */
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  /** "dark" = dark bg (white text), "light" = light bg (dark text) */
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  /* ----------------------------------------------------------------
     Background-aware theme detection
     Watches elements with [data-navbar-theme="light"|"dark"].
     When a tagged section overlaps the navbar zone (~top 60px),
     text colours flip automatically.
     ---------------------------------------------------------------- */
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-navbar-theme]");
    if (sections.length === 0) return;

    // Map to track which light sections are currently intersecting
    const visibleLight = new Set<HTMLElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const sectionTheme = el.dataset.navbarTheme;
          if (sectionTheme === "light") {
            if (entry.isIntersecting) {
              visibleLight.add(el);
            } else {
              visibleLight.delete(el);
            }
          }
        }
        setTheme(visibleLight.size > 0 ? "light" : "dark");
      },
      {
        // Only trigger when a section enters the top 64px strip (navbar zone)
        rootMargin: "0px 0px -95% 0px",
        threshold: 0,
      }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [pathname]); // re-scan after route change

  /* Derived colour tokens based on active theme */
  const isDark = theme === "dark";
  const textPrimary = isDark ? "text-[#F1FFFF]" : "text-[#0F0F10]";
  const textSecondary = isDark ? "text-[#F1FFFF]/75" : "text-[#0F0F10]/75";
  const textHover = isDark ? "hover:text-[#F1FFFF]" : "hover:text-[#0F0F10]";
  const hamburgerBg = isDark ? "bg-white" : "bg-[#0F0F10]";

  /* ----------------------------------------------------------------
     Scroll hide / show (reused from existing Navbar)
     ---------------------------------------------------------------- */
  useEffect(() => {
    if (!headerRef.current) return;

    const threshold = 10;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (Math.abs(delta) < threshold) return;

      if (delta > 0 && !isHidden.current && currentY > 96) {
        isHidden.current = true;
        setDropdownOpen(false); // close dropdown when hiding
        gsap.to(headerRef.current, {
          y: "-100%",
          duration: 0.4,
          ease: "power3.out",
        });
      } else if (delta < 0 && isHidden.current) {
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
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ----------------------------------------------------------------
     Close mobile menu on route change
     ---------------------------------------------------------------- */
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  /* ----------------------------------------------------------------
     Esc key closes dropdown
     ---------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ----------------------------------------------------------------
     Hover handlers — entire bar region (header + dropdown)
     Debounce close so fast mouse moves don't flicker.
     ---------------------------------------------------------------- */
  const openDropdown = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setDropdownOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setDropdownOpen(false), 120);
  }, []);

  const handleFocusCapture = useCallback(() => {
    if (window.innerWidth < 768) return;
    openDropdown();
  }, [openDropdown]);

  const handleBlurCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (window.innerWidth < 768) return;
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        closeDropdown();
      }
    },
    [closeDropdown]
  );

  /* ----------------------------------------------------------------
     GSAP micro-animation for dropdown enter / exit
     ---------------------------------------------------------------- */
  useEffect(() => {
    if (!dropdownRef.current) return;

    if (dropdownOpen) {
      gsap.killTweensOf(dropdownRef.current);
      gsap.set(dropdownRef.current, { display: "grid", opacity: 0, y: -8 });
      gsap.to(dropdownRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: "power3.out",
      });
      // Stagger child columns
      const cols = dropdownRef.current.querySelectorAll(".glass-nav-col");
      gsap.fromTo(
        cols,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: "power2.out", delay: 0.08 }
      );
    } else {
      gsap.killTweensOf(dropdownRef.current);
      gsap.to(dropdownRef.current, {
        opacity: 0,
        y: -6,
        duration: 0.22,
        ease: "power2.in",
        onComplete() {
          if (dropdownRef.current) gsap.set(dropdownRef.current, { display: "none" });
        },
      });
    }
  }, [dropdownOpen]);

  /* ----------------------------------------------------------------
     Shared grid template — matches Figma column positions
     Columns start at x: 32, 136, 244, 341, 489 inside the 593px container.
     ---------------------------------------------------------------- */
  const gridColumns = "104px 108px 97px 148px 104px";

  /* ----------------------------------------------------------------
     Render
     ---------------------------------------------------------------- */
  return (
    <header
      ref={headerRef}
      className="fixed inset-x-0 top-0 z-50 will-change-transform"
      data-navbar-active-theme={theme}
    >
      {/* ---- Top row: logo (left) + glass region (right) ---- */}
      <div className="flex items-start justify-between px-6 pt-3 md:px-8">
        {/* Left: logo — outside the glass, vertically aligned with pill center */}
        <Link
          href="/"
          className={`mt-[10px] transition-all duration-300 hover:opacity-80 ${isDark ? "text-white" : "text-[#0F0F10]"}`}
        >
          <TsiLogo width={32} height={32} />
        </Link>

        {/* Right: glass pill + dropdown wrapper — hover region */}
        <div
          className="relative"
          onMouseEnter={openDropdown}
          onMouseLeave={closeDropdown}
          onFocusCapture={handleFocusCapture}
          onBlurCapture={handleBlurCapture}
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
          aria-controls={dropdownId}
        >
          {/* ---- Glass pill (593 x 48, r15) ---- */}
          <div className={`glass-nav-bar relative w-[593px] rounded-[15px] transition-colors duration-300 ${isDark ? "" : "glass-nav-bar--light"}`}>
            <nav
              aria-label="Primary"
              className="relative z-[2] hidden h-[48px] items-center pl-[32px] md:grid"
              style={{ gridTemplateColumns: "104px 108px 97px 1fr" }}
            >
              {columns.slice(0, 3).map((col) => (
                <Link
                  key={col.heading}
                  href={col.href}
                  className={`glass-nav-link text-[13px] transition-colors duration-300 ${textHover} ${
                    pathname === col.href
                      ? textPrimary
                      : textSecondary
                  }`}
                  style={{ fontFamily: '"Test Sohne", sans-serif', fontWeight: 400 }}
                >
                  {col.heading}
                </Link>
              ))}

              {/* Last cell: Students + divider + Contact button */}
              <div className="relative flex h-full items-center">
                {/* Students link */}
                {columns[3] && (
                  <Link
                    href={columns[3].href}
                    className={`glass-nav-link text-[13px] transition-colors duration-300 ${textHover} ${
                      pathname === columns[3].href
                        ? textPrimary
                        : textSecondary
                    }`}
                    style={{ fontFamily: '"Test Sohne", sans-serif', fontWeight: 400 }}
                  >
                    {columns[3].heading}
                  </Link>
                )}

                {/* Divider — x=430 from pill left = 89px from this cell's left */}
                <svg
                  className="absolute"
                  style={{ left: "89px", top: "14px" }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="2"
                  height="22"
                  viewBox="0 0 2 22"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0.75 20.75L0.75 0.75"
                    stroke="#6C6C6C"
                    strokeOpacity="0.33"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Contact button — 112x32, r12, 15px from pill right edge */}
                <Link
                  href={ctaHref}
                  className={`ml-auto mr-[15px] flex h-[32px] w-[112px] items-center rounded-[12px] transition-all duration-300 ${
                    isDark
                      ? "bg-[#F1FFFF] hover:bg-[#F1FFFF]/90"
                      : "bg-[#0F0F10] hover:bg-[#0F0F10]/90"
                  }`}
                >
                  <span
                    className={`pl-[25px] text-[13px] font-semibold transition-colors duration-300 ${
                      isDark ? "text-[#0F0F10]" : "text-[#F1FFFF]"
                    }`}
                  >
                    {ctaLabel}
                  </span>
                  <Image
                    src="/atsign.png"
                    alt=""
                    width={16}
                    height={16}
                    className="ml-auto mr-[16px] h-[16px] w-[16px] rounded-full object-cover"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </nav>

            {/* Hamburger (mobile) */}
            <div className="flex h-[48px] items-center justify-center md:hidden">
              <button
                className="relative z-[2] flex flex-col justify-center items-center w-8 h-8 gap-[5px]"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
                aria-controls={mobileMenuId}
              >
                <span
                  className={`block w-5 h-[1.5px] ${hamburgerBg} transition-all duration-300 ${
                    mobileOpen ? "translate-y-[6.5px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`block w-5 h-[1.5px] ${hamburgerBg} transition-all duration-300 ${
                    mobileOpen ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`block w-5 h-[1.5px] ${hamburgerBg} transition-all duration-300 ${
                    mobileOpen ? "-translate-y-[6.5px] -rotate-45" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ---- Glass extension dropdown (593 x auto, r15, 11px gap) ---- */}
          <div
            ref={dropdownRef}
            id={dropdownId}
            className="glass-nav-dropdown mt-[11px] hidden w-[593px] rounded-[15px] py-[20px] pl-[32px]"
            style={{ display: "none", gridTemplateColumns: gridColumns }}
          >
            {columns.map((col) => (
              <div key={col.heading} className="glass-nav-col flex flex-col gap-[6px]">
                {col.items.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className={`glass-nav-dropdown-link group flex items-center gap-1.5 text-[13px] transition-colors duration-300 ${
                      isDark ? "text-[#F1FFFF]/60 hover:text-[#F1FFFF]" : "text-[#0F0F10]/60 hover:text-[#0F0F10]"
                    }`}
                    style={{ fontFamily: '"Test Sohne", sans-serif', fontWeight: 400 }}
                  >
                    {item.label}
                    {item.external && (
                      <svg
                        className="inline-block h-2.5 w-2.5 opacity-40 transition-opacity group-hover:opacity-80"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5" />
                      </svg>
                    )}
                  </Link>
                ))}
              </div>
            ))}

            {/* Extra utility column */}
            {extraLinks.length > 0 && (
              <div className="glass-nav-col flex flex-col gap-[6px]">
                {extraLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className={`glass-nav-dropdown-link group flex items-center gap-1.5 text-[13px] transition-colors duration-300 ${
                      isDark ? "text-[#F1FFFF]/60 hover:text-[#F1FFFF]" : "text-[#0F0F10]/60 hover:text-[#0F0F10]"
                    }`}
                    style={{ fontFamily: '"Test Sohne", sans-serif', fontWeight: 400 }}
                  >
                    {item.label}
                    {item.external && (
                      <svg
                        className="inline-block h-2.5 w-2.5 opacity-40 transition-opacity group-hover:opacity-80"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5" />
                      </svg>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Mobile menu ---- */}
      <div
        id={mobileMenuId}
        className={`glass-nav-mobile md:hidden absolute right-6 left-6 top-[68px] mt-1 rounded-[15px] px-8 py-6 flex flex-col gap-5 text-sm font-medium text-[#F1FFFF]/70 transition-all duration-300 ${
          mobileOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        {columns.map((col) => (
          <div key={col.heading} className="flex flex-col gap-2">
            <Link href={col.href} className="text-[#F1FFFF]/90 hover:text-[#F1FFFF] transition-colors">
              {col.heading}
            </Link>
            {col.items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="pl-4 text-xs text-[#F1FFFF]/40 hover:text-[#F1FFFF]/70 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        {extraLinks.length > 0 && (
          <>
            <hr className="border-[#F1FFFF]/10" />
            {extraLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="text-[#F1FFFF]/50 hover:text-[#F1FFFF] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </>
        )}
        <hr className="border-[#F1FFFF]/10" />
        <Link
          href={ctaHref}
          className="flex h-[32px] w-[112px] items-center rounded-[12px] bg-[#F1FFFF]"
        >
          <span className="pl-[25px] text-[13px] font-semibold text-[#0F0F10]">
            {ctaLabel}
          </span>
          <Image
            src="/atsign.png"
            alt=""
            width={16}
            height={16}
            className="ml-auto mr-[16px] h-[16px] w-[16px] rounded-full object-cover"
            aria-hidden="true"
          />
        </Link>
      </div>
    </header>
  );
}
