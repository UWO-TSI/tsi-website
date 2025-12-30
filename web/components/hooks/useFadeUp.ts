import { useEffect } from "react";
import { gsap } from "gsap";

export function useFadeUp(
  ref: React.RefObject<HTMLElement>,
  options?: Partial<gsap.TweenVars>
) {
  useEffect(() => {
    if (!ref.current) return;

    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        ...options,
      }
    );
  }, []);
}