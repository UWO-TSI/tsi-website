"use client";

/**
 * An item's picture with the game's pixel finish (David, 2026-10-18: "pixel filter for all"): the image drawn small
 * (`px` square, averaged down) on a canvas the page then scales up without smoothing, as the world's pixel mode does.
 */
import { useEffect, useRef } from "react";

export default function PixelImage({ src, px = 44, className, label }: { src: string; px?: number; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const c = ref.current;
      if (!live || !c) return;
      const g = c.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, px, px);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      const k = Math.min(px / img.width, px / img.height), w = img.width * k, h = img.height * k;
      g.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
    };
    img.src = src;
    return () => { live = false; };
  }, [src, px]);
  return <canvas ref={ref} width={px} height={px} className={className} style={{ imageRendering: "pixelated" }}
    role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
