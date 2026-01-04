"use client";

import SmoothScroll from "@/components/SmoothScroll";
import UnderConstruction from "@/components/sections/UnderConstruction";

export default function UnderConstructionPage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <UnderConstruction />
      </main>
    </SmoothScroll>
  );
}

