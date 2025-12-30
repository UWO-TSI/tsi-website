"use client";

import { useEffect, useRef, ReactNode } from "react";
import { gsap } from "gsap";
import Button from "@/components/ui/Button";
import ButtonHelperText from "@/components/ui/ButtonHelperText";
import ScrollHint from "@/components/hero/ScrollHint";

type CTA = {
  label: string;
  helperText: string;
  variant?: "primary" | "secondary";
};

type CompanyHeroProps = {
  title: ReactNode;
  ctas: CTA[];
};

export function CompanyHero({ title, ctas }: CompanyHeroProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }
    );
  }, []);

  return (
    <section className="relative bg-[#0F0F10] h-[calc(100vh-96px)] flex items-center justify-center">
      <div ref={contentRef} className="text-center max-w-5xl px-6">
        <h1 className="font-heading text-5xl md:text-6xl mb-14">{title}</h1>

        <div className="flex flex-col sm:flex-row gap-14 justify-center">
          {ctas.map((cta, i) => (
            <div key={i} className="w-[260px] flex flex-col items-center">
              <Button variant={cta.variant}>{cta.label}</Button>
              <ButtonHelperText className="mt-3">
                {cta.helperText}
              </ButtonHelperText>
            </div>
          ))}
        </div>
      </div>

      <ScrollHint label="Scroll for more info" />
    </section>
  );
}