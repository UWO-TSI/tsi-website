"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[96px]">
      <div className="flex h-full w-full items-center justify-between pl-[34px] pr-[34px]">
        {/* Left: logo */}
        <Link href="/" className="font-heading text-sm font-semibold tracking-wide hover:opacity-80 transition-opacity">
          TETHOS
        </Link>

        {/* Middle: pathways */}
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

        {/* Right: actions */}
        <div className="flex items-center gap-3 text-xs">
          <button className="text-zinc-300 transition-colors hover:text-white">
            Contact
          </button>
          <button className="rounded-full bg-[#002FA7] px-4 py-2 text-[11px] font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
            Apply
          </button>
        </div>
      </div>
    </header>
  );
}