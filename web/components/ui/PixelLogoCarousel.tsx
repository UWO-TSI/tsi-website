"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Logo {
  name: string;
  /** Optional image src. If not provided, renders text */
  src?: string;
}

interface PixelLogoCarouselProps {
  logos: Logo[];
  /** Pixel block size in px */
  pixelSize?: number;
  /** Time between transitions in ms */
  interval?: number;
  /** Transition duration in ms */
  transitionDuration?: number;
  /** Canvas width */
  width?: number;
  /** Canvas height */
  height?: number;
  className?: string;
}

/**
 * PixelLogoCarousel — Logos dissolve into pixel blocks and reassemble as the next logo.
 * Uses offscreen canvas to sample logo shapes, then animates a grid of cells.
 */
export default function PixelLogoCarousel({
  logos,
  pixelSize = 8,
  interval = 3000,
  transitionDuration = 800,
  width = 280,
  height = 60,
  className = "",
}: PixelLogoCarouselProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentIndexRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cols = Math.ceil(width / pixelSize);
  const rows = Math.ceil(height / pixelSize);

  // Render a logo name to an offscreen canvas and return pixel grid data
  const sampleLogo = useCallback(
    (logo: Logo): boolean[][] => {
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext("2d");
      if (!ctx) return Array.from({ length: rows }, () => Array(cols).fill(false));

      ctx.clearRect(0, 0, width, height);

      // Render text
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Auto-size font to fit
      let fontSize = 32;
      ctx.font = `600 ${fontSize}px "Test Sohne", "Inter", -apple-system, sans-serif`;
      while (ctx.measureText(logo.name).width > width * 0.9 && fontSize > 10) {
        fontSize--;
        ctx.font = `600 ${fontSize}px "Test Sohne", "Inter", -apple-system, sans-serif`;
      }

      ctx.fillText(logo.name, width / 2, height / 2);

      // Sample grid
      const imageData = ctx.getImageData(0, 0, width, height);
      const grid: boolean[][] = [];

      for (let r = 0; r < rows; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < cols; c++) {
          // Sample center of each cell
          const sx = Math.min(Math.floor(c * pixelSize + pixelSize / 2), width - 1);
          const sy = Math.min(Math.floor(r * pixelSize + pixelSize / 2), height - 1);
          const idx = (sy * width + sx) * 4;
          // Check alpha channel
          row.push(imageData.data[idx + 3] > 40);
        }
        grid.push(row);
      }

      return grid;
    },
    [width, height, pixelSize, cols, rows]
  );

  // Animate the pixel grid
  const renderGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      fromGrid: boolean[][],
      toGrid: boolean[][],
      progress: number // 0 = showing 'from', 1 = showing 'to'
    ) => {
      ctx.clearRect(0, 0, width, height);

      const gap = 1; // 1px gap between pixels
      const cellW = pixelSize - gap;
      const cellH = pixelSize - gap;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fromActive = fromGrid[r]?.[c] ?? false;
          const toActive = toGrid[r]?.[c] ?? false;

          // Calculate per-cell stagger based on distance from center
          const centerC = cols / 2;
          const centerR = rows / 2;
          const dist =
            Math.sqrt((c - centerC) ** 2 + (r - centerR) ** 2) /
            Math.sqrt(centerC ** 2 + centerR ** 2);

          // Stagger: center pixels transition first, edges last
          const stagger = dist * 0.4;
          const cellProgress = Math.max(
            0,
            Math.min(1, (progress - stagger) / (1 - stagger * 0.8))
          );

          let opacity = 0;
          let scale = 1;

          if (fromActive && toActive) {
            // Both active: stay on, slight flicker at midpoint
            opacity = 1 - Math.sin(cellProgress * Math.PI) * 0.15;
            scale = 1;
          } else if (fromActive && !toActive) {
            // Dissolving out
            opacity = 1 - cellProgress;
            scale = 1 - cellProgress * 0.3;
          } else if (!fromActive && toActive) {
            // Assembling in
            opacity = cellProgress;
            scale = 0.7 + cellProgress * 0.3;
          } else {
            // Both inactive
            continue;
          }

          if (opacity < 0.01) continue;

          const x = c * pixelSize;
          const y = r * pixelSize;

          ctx.globalAlpha = opacity;

          if (scale !== 1) {
            const cx = x + cellW / 2;
            const cy = y + cellH / 2;
            const sw = cellW * scale;
            const sh = cellH * scale;
            ctx.fillStyle = "#F1FFFF";
            ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
          } else {
            ctx.fillStyle = "#F1FFFF";
            ctx.fillRect(x, y, cellW, cellH);
          }
        }
      }

      ctx.globalAlpha = 1;
    },
    [width, height, pixelSize, cols, rows]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || logos.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Pre-sample all logos
    const grids = logos.map((logo) => sampleLogo(logo));

    // Render initial state
    const emptyGrid = Array.from({ length: rows }, () =>
      Array(cols).fill(false)
    );
    renderGrid(ctx, emptyGrid, grids[0], 1);

    let currentIdx = 0;

    const transition = () => {
      const nextIdx = (currentIdx + 1) % logos.length;
      const fromGrid = grids[currentIdx];
      const toGrid = grids[nextIdx];

      const startTime = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / transitionDuration);

        // Ease in-out
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        renderGrid(ctx, fromGrid, toGrid, eased);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          currentIdx = nextIdx;
          currentIndexRef.current = nextIdx;
          // Schedule next transition
          timeoutRef.current = setTimeout(transition, interval);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    };

    // Start cycling
    timeoutRef.current = setTimeout(transition, interval);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [logos, sampleLogo, renderGrid, interval, transitionDuration, cols, rows]);

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height }}
        className="block"
      />
    </div>
  );
}
