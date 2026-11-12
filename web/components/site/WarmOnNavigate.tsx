"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { warmImages } from "@/lib/site/warm";

/** After each page navigation, once the browser is idle, loads and decodes that page's images before you scroll to them. */
export default function WarmOnNavigate() {
  const path = usePathname();
  useEffect(() => {
    const run = () => { warmImages(); };
    // Safari has no requestIdleCallback; a short timeout stands in for it there.
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(run, 400);
    return () => clearTimeout(id);
  }, [path]);
  return null;
}
