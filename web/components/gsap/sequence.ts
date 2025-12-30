import { gsap } from "gsap";

type Elements = Element | Element[] | NodeListOf<Element> | null;

export function fadeIn(
  tl: gsap.core.Timeline,
  el: Element | null,
  at = 0,
  duration = 0.3
) {
  if (!el) return;
  tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration }, at);
}

export function fadeInStagger(
  tl: gsap.core.Timeline,
  els: Elements,
  at = 0,
  stagger = 0.12,
  duration = 0.15
) {
  const elements =
    els instanceof Element ? [els] : els ? Array.from(els) : [];
  if (!elements.length) return;

  tl.fromTo(
    elements,
    { opacity: 0 },
    { opacity: 1, duration, stagger },
    at
  );
}

export function fadeUp(
  tl: gsap.core.Timeline,
  el: Element | null,
  at = 0,
  y = 16,
  duration = 0.3
) {
  if (!el) return;

  tl.fromTo(
    el,
    { opacity: 0, y },
    { opacity: 1, y: 0, duration, ease: "power2.out" },
    at
  );
}

export function revealCards(
  tl: gsap.core.Timeline,
  container: Element | null,
  at = 0.25
) {
  if (!container) return;
  fadeInStagger(
    tl,
    container.querySelectorAll(".pathway-card"),
    at,
    0.12,
    0.15
  );
}