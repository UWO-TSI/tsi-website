"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CompanyNavbar() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[96px]">
      <div className="flex h-full w-full items-center justify-between pl-[34px] pr-[34px]">
        {/* Left: logo */}
        <Link
          href="/"
          className="font-heading text-sm font-semibold tracking-wide hover:opacity-80 transition-opacity"
        >
          TETHOS
        </Link>

        {/* Middle: company sections */}
        <nav className="hidden gap-24 text-xs font-medium text-zinc-300 md:flex">
          <Link
            href="/company#build"
            className="transition-colors hover:text-white"
          >
            Build
          </Link>

          <Link
            href="/company#work"
            className="transition-colors hover:text-white"
          >
            Work
          </Link>

          <Link
            href="/company#talent"
            className="transition-colors hover:text-white"
          >
            Talent
          </Link>

          <Link
            href="/company#team"
            className="transition-colors hover:text-white"
          >
            Team
          </Link>

          <Link
            href="/company#faqs"
            className="transition-colors hover:text-white"
          >
            FAQs
          </Link>
          
          <Link
            href="/company#getStarted"
            className="transition-colors hover:text-white"
          >
            Get Started
          </Link>
        </nav>

        {/* Right: pathway label / CTA */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-heading text-sm font-semibold tracking-wide text-zinc-300">
            Company Pathway
          </span>
        </div>
      </div>
    </header>
  );
}