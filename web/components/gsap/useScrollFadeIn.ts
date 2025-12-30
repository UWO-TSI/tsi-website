"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type FadeInOptions = {
  pin?: boolean;
  scrub?: boolean | number;
  start?: string;
  end?: string;
  cardSelector?: string;
};

export function useScrollFadeIn(
  sectionRef: React.RefObject<HTMLElement>,
  refs: {
    title?: React.RefObject<HTMLElement>;
    subtitle?: React.RefObject<HTMLElement>;
    container?: React.RefObject<HTMLElement>;
  },
  {
    pin = true,
    scrub = 1,
    start = "top top",
    end = "+=120%",
    cardSelector = ".pathway-card",
  }: FadeInOptions = {}
) {
  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start,
          end,
          scrub,
          pin,
          pinReparent: true,
          anticipatePin: 1,
        },
      });

      /* Title */
      if (refs.title?.current) {
        tl.fromTo(
          refs.title.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3 },
          0
        );
      }

      /* Subtitle */
      if (refs.subtitle?.current) {
        tl.fromTo(
          refs.subtitle.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.25 },
          0.1
        );
      }

      /* Cards */
      const cards =
        refs.container?.current?.querySelectorAll(cardSelector) ?? [];

      cards.forEach((card, i) => {
        tl.fromTo(
          card,
          { opacity: 0 },
          { opacity: 1, duration: 0.15 },
          0.25 + i * 0.12
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [
    sectionRef,
    refs.title,
    refs.subtitle,
    refs.container,
    pin,
    scrub,
    start,
    end,
    cardSelector,
  ]);
}