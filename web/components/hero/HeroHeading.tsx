import type { ReactNode } from "react";

interface HeroHeadingProps {
  children: ReactNode;
}

export default function HeroHeading({ children }: HeroHeadingProps) {
  return (
    <h1 className="font-heading text-5xl md:text-6xl font-semibold leading-tight tracking-tight mb-14">
      {children}
    </h1>
  );
}