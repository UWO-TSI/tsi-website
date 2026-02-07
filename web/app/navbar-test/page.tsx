import GlassNavbar from "@/components/layout/GlassNavbar";

export default function NavbarTestPage() {
  return (
    <div className="min-h-[300vh] bg-[#0F0F10]">
      <GlassNavbar />

      {/* Spacer so we can test scroll hide/show */}
      <div className="flex items-center justify-center pt-40">
        <p className="text-white/40 text-sm">
          Navbar isolation test — scroll down to test hide, scroll up to test
          show, hover the glass pill to test dropdown.
        </p>
      </div>

      {/* Section markers for scroll testing */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[30vh] items-center justify-center border-t border-white/5"
        >
          <span className="text-white/20 text-xs">Section {i + 1}</span>
        </div>
      ))}
    </div>
  );
}
