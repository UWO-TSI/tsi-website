"use client";
import { useLayoutEffect, type ReactNode } from "react";
import CompaniesNavbar from "@/components/layout/CompaniesNavbar";

export default function CompaniesLayout({
  children,
}: {
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Force scroll to top BEFORE paint
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });

    // Force again AFTER hydration & browser restore
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    });

    // Final safety pass (Safari / Chrome edge case)
    const timeout = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }, 0);

    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timeout);
    };
  }, []);
  return (
    <>
      <CompaniesNavbar />
      <main className="pt-[96px]">{children}</main>
    </>
  );
}