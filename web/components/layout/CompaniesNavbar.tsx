"use client";

import Link from "next/link";

export default function CompaniesNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[96px]">
      <div className="flex h-full w-full items-center justify-between pl-[34px] pr-[34px]">
        {/* Left: logo */}
        <div className="font-heading text-sm font-semibold tracking-wide">TETHOS</div>

        {/* Middle: pathways */}
        <nav className="hidden gap-24 text-xs font-medium text-zinc-300 md:flex">
          <Link href="/companies#build" className="transition-colors hover:text-white"> Build</Link>
          <Link href="/companies#work" className="transition-colors hover:text-white"> Work</Link>
          <Link href="/companies#talent" className="transition-colors hover:text-white"> Talent</Link>
          <Link href="/companies#team" className="transition-colors hover:text-white"> Team</Link>
          <Link href="/companies#faqs" className="transition-colors hover:text-white"> FAQs</Link>
          <Link href="/companies#getStarted" className="transition-colors hover:text-white"> Get Started</Link>


        </nav>

        {/* Right: Company Pathway */}
        <div className="font-heading text-sm font-semibold tracking-wide">
          Company Pathway
        </div>
      </div>
    </header>
  );
}
