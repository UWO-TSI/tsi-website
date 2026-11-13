"use client";

import Link from "next/link";
import { useEffect, useRef, type ComponentType, type CSSProperties, type ElementType, type ReactNode } from "react";

type Props = { as?: ElementType; delay?: number; className?: string; style?: CSSProperties; children: ReactNode } & Record<string, unknown>;

/** Rises 14px and fades in the first time it comes into view (0.7s). With an `href` it renders a Next link. */
export default function Reveal({ as = "div", delay = 0, className = "", style, children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.dataset.in = "true"; io.disconnect(); }
    }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = (typeof rest.href === "string" ? Link : as) as ComponentType<Record<string, unknown>>;
  return (
    <Tag ref={ref} className={`ts-reveal ${className}`} style={{ ...style, transitionDelay: delay ? `${delay}s` : undefined }} {...rest}>
      {children}
    </Tag>
  );
}
