"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CardFan } from "@/components/cards/CardFan";
import type { PathwayCard } from "@/components/cards/types";

const cards: PathwayCard[] = [
  { title: "Nonprofits", subtitle: "Pro bono software support for 1 year", href: "/npo" },
  { title: "Companies", subtitle: "Hire for scoped project and consulting", href: "/company" },
  { title: "Sponsors", subtitle: "Fund tech that drives social impact", href: "/sponsor" },
  { title: "Students", subtitle: "Start a TETHOS Chapter", href: "/student" },
];

export default function PathwaySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const helperTextRef = useRef<HTMLParagraphElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=200%",
          scrub: 1,
          pin: true,
        },
      });

      tl.fromTo(titleRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });

      cardsContainerRef.current
        ?.querySelectorAll(".pathway-card")
        .forEach((card, i) => {
          tl.fromTo(card, { opacity: 0 }, { opacity: 1 }, 0.2 + i * 0.12);
        });

      tl.fromTo(helperTextRef.current, { opacity: 0 }, { opacity: 1 }, 0.8);
    }, sectionRef);

    return () => ctx.revert();
  }, []);
}