/**
 * The bite's "!" over the angler, by hook tier (specs/launch/v1-gameplay.md, "Fish tiers and fights"; lib/game/
 * fishing.ts HOOK). Plain DOM, built fresh into `host` on each bite (FishingRig's label, FishingBobber's Html):
 *   common     a paper bubble with a coral mark that pops in;
 *   legendary  a bigger golden bubble that glows and throws gold sparks;
 *   divine     bigger still, holographic, with a beam of light through it, rays turning behind it and bursting rings.
 * Every animation is finite (it ends with the bite's window). Reduced motion keeps the look and drops the effects.
 */
import { HOLO_GRADIENT, type HookTier } from "@/lib/game/fishing";

/** The paper bubble's look (the GUI sheet's tokens, plain values outside its scope). */
const PAPER = "var(--gui-paper-hi, #fffff7)";
const FONT = "var(--gui-font, var(--font-highlight, sans-serif))";
const POP: Keyframe[] = [{ transform: "translateY(10px) scale(0.2) rotate(-14deg)" }, { transform: "translateY(-6px) scale(1.25) rotate(6deg)", offset: 0.55 }, { transform: "translateY(0) scale(1) rotate(-3deg)" }];
const POP_TIMING: KeyframeAnimationOptions = { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" };

const LOOK: Record<HookTier, { size: number; font: number; ink: string; background: string; ring: string; shadow: string }> = {
  common: {
    size: 44, font: 30, ink: "var(--gui-coral-ink, #b4513a)", background: PAPER, ring: "var(--gui-coral, #e2826a)",
    shadow: "0 3px 0 rgb(114 92 78 / 0.18), 0 10px 22px rgb(79 63 49 / 0.18)",
  },
  legendary: {
    size: 56, font: 40, ink: "#7a4606", background: "radial-gradient(circle at 38% 30%, #fffbe0 0%, #ffe27a 38%, #f2b53a 100%)", ring: "#fff3b8",
    shadow: "0 3px 0 rgb(122 70 6 / 0.35), 0 0 22px 6px rgb(255 205 80 / 0.75)",
  },
  divine: {
    size: 70, font: 52, ink: "#fffef6", background: HOLO_GRADIENT, ring: "#ffffff",
    shadow: "0 3px 0 rgb(60 40 110 / 0.35), 0 0 30px 10px rgb(190 160 255 / 0.8), 0 0 60px 20px rgb(120 230 255 / 0.45)",
  },
};
const SPARKS: Record<HookTier, { count: number; reach: number; colors: string[]; waves: number }> = {
  common: { count: 0, reach: 0, colors: [], waves: 0 },
  legendary: { count: 10, reach: 58, colors: ["#ffe27a", "#fff8d6", "#f2b53a"], waves: 2 },
  divine: { count: 16, reach: 92, colors: ["#ffffff", "#7dffc4", "#b57aff", "#6ea8ff", "#ffe27a"], waves: 3 },
};

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function layer(host: HTMLElement, css: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `position:absolute;left:50%;top:50%;pointer-events:none;${css}`;
  host.appendChild(el);
  return el;
}

/** Pops the bite's "!" for `tier` into `host` (a 0-size anchor, centred on the head), replacing what was there. */
export function popBang(host: HTMLElement, tier: HookTier): void {
  host.replaceChildren();
  host.dataset.hook = tier;
  const look = LOOK[tier], calm = reducedMotion();
  if (tier === "divine" && !calm) {
    // A beam of light up and down through the "!", rays turning behind it, two rings bursting out.
    const beam = layer(host, "width:46px;height:340px;margin:-170px 0 0 -23px;border-radius:23px;background:linear-gradient(transparent, rgb(255 255 255 / 0.85) 35%, rgb(160 235 255 / 0.9) 50%, rgb(255 255 255 / 0.85) 65%, transparent);filter:blur(3px);mix-blend-mode:screen");
    beam.animate([{ transform: "scaleY(0)", opacity: 0 }, { transform: "scaleY(1.1)", opacity: 1, offset: 0.25 }, { transform: "scaleY(1)", opacity: 0.85, offset: 0.6 }, { transform: "scaleY(0.9)", opacity: 0 }], { duration: 1800, easing: "ease-out", fill: "forwards" });
    const rays = layer(host, "width:220px;height:220px;margin:-110px 0 0 -110px;border-radius:50%;background:repeating-conic-gradient(rgb(255 255 255 / 0.55) 0deg 7deg, transparent 7deg 30deg);-webkit-mask:radial-gradient(circle, #000 20%, transparent 70%);mask:radial-gradient(circle, #000 20%, transparent 70%)");
    rays.animate([{ transform: "rotate(0) scale(0.3)", opacity: 0 }, { transform: "rotate(40deg) scale(1)", opacity: 1, offset: 0.3 }, { transform: "rotate(150deg) scale(1.1)", opacity: 0 }], { duration: 2200, easing: "linear", fill: "forwards" });
    for (let i = 0; i < 2; i++) {
      const ring = layer(host, `width:80px;height:80px;margin:-40px 0 0 -40px;border-radius:50%;border:3px solid ${i ? "#7dffc4" : "#ffffff"};box-shadow:0 0 12px rgb(180 150 255 / 0.9)`);
      ring.animate([{ transform: "scale(0.4)", opacity: 1 }, { transform: "scale(3.2)", opacity: 0 }], { duration: 900, delay: i * 260, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" });
    }
  }
  const bubble = layer(host, [
    `width:${look.size}px;height:${look.size}px;margin:${-look.size / 2}px 0 0 ${-look.size / 2}px;line-height:${look.size}px`,
    "text-align:center;border-radius:46% 50% 44% 48% / 54% 50% 46% 52%",
    `font-family:${FONT};font-size:${look.font}px;font-weight:900;color:${look.ink};background:${look.background}`,
    `box-shadow:${look.shadow}, inset 0 0 0 2.5px ${look.ring}`,
    tier === "divine" ? "text-shadow:0 0 6px rgb(90 60 170 / 0.9), 0 2px 0 rgb(60 40 110 / 0.6);background-size:200% 200%" : "",
  ].join(";"));
  bubble.textContent = "!";
  bubble.animate(POP, tier === "common" ? POP_TIMING : { ...POP_TIMING, duration: tier === "divine" ? 560 : 460 });
  if (calm) return;
  if (tier === "legendary") bubble.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.35)" }], { duration: 300, iterations: 6, direction: "alternate", delay: 380 });
  if (tier === "divine") bubble.animate([{ backgroundPosition: "0% 50%", filter: "brightness(1)" }, { backgroundPosition: "100% 50%", filter: "brightness(1.3)" }], { duration: 600, iterations: 4, direction: "alternate" });
  const sparks = SPARKS[tier];
  for (let w = 0; w < sparks.waves; w++) {
    for (let i = 0; i < sparks.count; i++) {
      const a = ((i + (w % 2) * 0.5) / sparks.count) * Math.PI * 2, d = sparks.reach * (0.75 + ((i * 7 + w * 3) % 5) / 10);
      const size = 5 + ((i + w) % 3) * 2, color = sparks.colors[(i + w) % sparks.colors.length];
      const spark = layer(host, `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;background:${color};transform:rotate(45deg) scale(0);box-shadow:0 0 6px ${color}`);
      spark.animate([
        { transform: "translate(0, 0) rotate(45deg) scale(0.4)", opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 10}px) rotate(225deg) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * d * 1.15}px, ${Math.sin(a) * d + 30}px) rotate(300deg) scale(0)`, opacity: 0 },
      ], { duration: 760, delay: 120 + w * 420, easing: "cubic-bezier(0.15, 0.8, 0.4, 1)", fill: "both" });
    }
  }
}
