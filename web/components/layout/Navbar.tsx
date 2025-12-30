import Link from "next/link";

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[96px]">
      <div className="flex h-full w-full items-center justify-between pl-[34px] pr-[34px]">
        {/* Left: logo */}
        <div className="font-heading text-sm font-semibold tracking-wide">
          TETHOS
        </div>

        {/* Middle: pathways */}
        <nav className="hidden gap-24 text-xs font-medium text-zinc-300 md:flex">
          <button className="transition-colors hover:text-white">Nonprofits</button>
          <Link href="/companies" className="transition-colors hover:text-white"> Companies</Link>
          <button className="transition-colors hover:text-white">Sponsors</button>
          <button className="transition-colors hover:text-white">Students</button>
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