import GlassNavbar from "@/components/layout/GlassNavbar";

export default function NavbarTestPage() {
  return (
    <div className="min-h-[300vh]">
      <GlassNavbar />

      {/* Dark section */}
      <section data-navbar-theme="dark" className="bg-[#0F0F10] pt-40 pb-20">
        <div className="flex items-center justify-center">
          <p className="text-white/40 text-sm">
            Dark section — navbar text should be white. Scroll down to see it
            switch.
          </p>
        </div>
      </section>

      {/* Light section */}
      <section data-navbar-theme="light" className="bg-white py-40">
        <div className="flex items-center justify-center">
          <p className="text-[#0F0F10]/40 text-sm">
            Light section — navbar text should be dark.
          </p>
        </div>
      </section>

      {/* Dark section */}
      <section data-navbar-theme="dark" className="bg-[#0F0F10] py-40">
        <div className="flex items-center justify-center">
          <p className="text-white/40 text-sm">
            Dark section — navbar text should be white again.
          </p>
        </div>
      </section>

      {/* Light section */}
      <section data-navbar-theme="light" className="bg-[#F5F5F5] py-40">
        <div className="flex items-center justify-center">
          <p className="text-[#0F0F10]/40 text-sm">
            Another light section — navbar text should be dark.
          </p>
        </div>
      </section>

      {/* Final dark section */}
      <section data-navbar-theme="dark" className="bg-[#0F0F10] py-60">
        <div className="flex items-center justify-center">
          <p className="text-white/40 text-sm">
            Final dark section — back to white text.
          </p>
        </div>
      </section>
    </div>
  );
}
