"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Points spread evenly over a sphere (golden spiral). */
function spherePoints(n: number) {
  const pts: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return pts;
}

/**
 * The closing dive: the globe comes back as a dotted sphere (light, Canvas 2D, so the page never runs two
 * WebGPU scenes), grows as you scroll, and a light disc opens out of its centre holding the last call.
 * 90svh of scroll: the sphere grows over the first 60%, the disc opens from 45% to 90%.
 */
export default function Closing() {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const pts = spherePoints(1600);
    let scale = 0.36, visible = false, raf = 0, angle = 0, dpr = 1;

    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
    };
    const draw = () => {
      const w = cv.width, h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const radius = Math.min(w, h) * scale;
      const cos = Math.cos(angle), sin = Math.sin(angle), tilt = 0.35;
      for (const [x0, y0, z0] of pts) {
        const x = x0 * cos - z0 * sin;
        const z = x0 * sin + z0 * cos;
        const y = y0 * Math.cos(tilt) - z * Math.sin(tilt);
        const zz = y0 * Math.sin(tilt) + z * Math.cos(tilt);
        if (zz < -0.15) continue;
        const depth = (zz + 1) / 2;
        ctx.globalAlpha = 0.2 + depth * 0.8;
        ctx.fillStyle = depth > 0.92 ? "#1d9bf0" : "#f1ffff";
        const s = (1.1 + depth * 1.9) * dpr;
        ctx.fillRect(w / 2 + x * radius - s / 2, h / 2 - y * radius - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    };
    const loop = () => {
      raf = 0;
      if (!visible) return;
      angle += reduce ? 0 : 0.0025;
      draw();
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); });
    io.observe(cv);
    size();
    window.addEventListener("resize", size);

    let st: ScrollTrigger | null = null;
    if (!reduce) {
      const el = stage.current!;
      st = ScrollTrigger.create({
        trigger: track.current, start: "top top", end: "bottom bottom",
        onUpdate: (self) => {
          const p = self.progress;
          scale = 0.36 + 0.9 * clamp(p / 0.6) ** 1.3;
          const f = clamp((p - 0.45) / 0.45) ** 1.6;
          el.style.setProperty("--r", `${((f * Math.hypot(el.clientWidth, el.clientHeight)) / 2).toFixed(1)}px`);
          if (!raf && visible) raf = requestAnimationFrame(loop);
        },
      });
    } else {
      draw();
    }
    return () => { st?.kill(); io.disconnect(); window.removeEventListener("resize", size); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <section ref={track} className="cl-track" data-tone="dark" id="join" aria-labelledby="join-title">
      <div ref={stage} className="cl-stage">
        <canvas ref={canvas} className="cl-dots" aria-hidden="true" />
        <div className="cl-disc" data-tone="light">
          <div className="cl-disc__inner">
            <p className="ts-label">For students</p>
            <h2 className="ts-h2" id="join-title">Build with us.</h2>
            <p className="ts-lede" style={{ textAlign: "center" }}>Hiring runs in September for project managers, developers and directors, {"and in May for next year's leadership. Every role starts in the applicant portal."}</p>
            <Link href="/student/apply" className="ts-btn ts-btn--primary">See open roles <span className="ts-btn__arrow">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
