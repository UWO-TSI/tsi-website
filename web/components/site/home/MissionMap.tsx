"use client";

import { useEffect, useRef, useState } from "react";
import globeData from "@/data/globe-nodes.json";
import { canvasDpr } from "@/lib/site/perf";

// The page grain's cell, so the map and the grain share one grid.
const CW = 7;
const CH = 12;
const PHRASE = "PRO BONO · NONPROFITS · STUDENT TEAMS · BUILT FOR PURPOSE · ";
const INK = "#0f0f10";
const BLUE = "#1d9bf0";
// The land map (public/images/site/world-land.png): the globe's own point cloud unrolled, lng -180..180, lat 80..-58.
const MAP_W = 360, MAP_H = 138, LAT0 = 80, LAT1 = -58;
// What each screen shows, and where: on wide screens North America (both chapters, nearly every partner) in the right part of the sheet, beside
// the words; on narrow ones North America (both chapters) across the bottom, under them.
const WIDE_VIEW = { lng0: -134, lng1: -52, lat0: 64, lat1: 12, left: 0.4 };
const NARROW_VIEW = { lng0: -132, lng1: -66, lat0: 62, lat1: 20, left: 0 };
// Where each chapter is, in words (the data has the coordinates).
const CITY: Record<string, string> = { "ch-western": "London, ON", "ch-ubc": "Vancouver, BC" };

type Node = { id: string; label: string; lat: number; lng: number };
type Marker = { id: string; label: string; city: string; x: number; y: number; side: "left" | "right" };

/**
 * The paper the globe dives into: the world, unrolled from the globe's own points, written in faint dark characters on
 * the page grain's grid (the land spells the mission, higher ground denser), with a fine dot texture over the sea so
 * the whole sheet has the grain. The nonprofits teams have built for are small blue cells; the two chapters are
 * labelled markers. Drawn once per size; only the markers pulse (CSS).
 */
export default function MissionMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let land: Uint8ClampedArray | null = null;

    const draw = () => {
      if (!land) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = canvasDpr();
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const view = w <= 820 ? NARROW_VIEW : WIDE_VIEW;
      // The view fills its share of the width, in its own proportions (a degree of longitude as wide as one of latitude).
      const vw = view.lng1 - view.lng0, vh = view.lat0 - view.lat1;
      // Beside the words: the map starts just past wherever the mission's text ends (their boxes, unscaled).
      let left = w * view.left;
      const inner = canvas.closest(".hd-reveal")?.querySelector<HTMLElement>(".hd-reveal__inner");
      if (view.left && inner) {
        let right = 0;
        for (const el of Array.from(inner.children) as HTMLElement[]) right = Math.max(right, el.offsetLeft + el.offsetWidth);
        left = Math.max(left, inner.offsetLeft + right + w * 0.03);
      }
      const scale = Math.min((w - left) / vw, (h * 0.86) / vh);
      const mapW = vw * scale, mapH = vh * scale;
      const ox = view.left ? w - mapW : (w - mapW) / 2, oy = w <= 820 ? h - mapH - 24 : (h - mapH) / 2 + h * 0.03;
      const project = (lat: number, lng: number) => ({ x: ox + (lng - view.lng0) * scale, y: oy + (view.lat0 - lat) * scale });
      const sample = (x: number, y: number) => {
        const lng = view.lng0 + (x - ox) / scale, lat = view.lat0 - (y - oy) / scale;
        if (lng < view.lng0 || lng >= view.lng1 || lat > view.lat0 || lat < view.lat1) return 0;
        if (lat > LAT0 || lat < LAT1 || lng < -180 || lng >= 180) return 0;
        const c = Math.floor(((lng + 180) / 360) * MAP_W), r = Math.floor(((LAT0 - lat) / (LAT0 - LAT1)) * MAP_H);
        return land![(r * MAP_W + c) * 4] / 255;
      };
      const cols = Math.ceil(w / CW), rows = Math.ceil(h / CH);
      ctx.font = `500 ${CH - 2}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = INK;
      let k = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * CW, y = (r + 0.5) * CH;
        const v = sample(x, y);
        if (v > 0) {
          // The view's edges fade, so the land never stops on a straight line.
          const ex = Math.min(1, (x - ox) / (mapW * 0.12), (ox + mapW - x) / (mapW * 0.04)), ey = Math.min(1, (y - oy) / (mapH * 0.1), (oy + mapH - y) / (mapH * 0.16));
          ctx.globalAlpha = (0.16 + 0.3 * v) * Math.max(0, Math.min(ex, ey));
          ctx.fillText(PHRASE[k++ % PHRASE.length], x, y + 0.5);
        } else if ((r + c) % 2 === 0) {
          // The sea: a fine dot grid, so the paper itself has the grain.
          ctx.globalAlpha = 0.07;
          ctx.fillText("·", x, y);
        }
      }
      // The nonprofits teams have built for: a blue cell each.
      ctx.fillStyle = BLUE;
      for (const p of (globeData.partners ?? []) as Node[]) {
        const { x, y } = project(p.lat, p.lng);
        const cx = Math.floor(x / CW) * CW + CW / 2, cy = Math.floor(y / CH) * CH + CH / 2;
        ctx.globalAlpha = 0.85;
        ctx.fillText("■", cx, cy);
      }
      ctx.globalAlpha = 1;
      setMarkers(((globeData.chapters ?? []) as Node[]).map((ch) => { const at = project(ch.lat, ch.lng); return { id: ch.id, label: ch.label, city: CITY[ch.id] ?? "", ...at, side: at.x > w - 200 ? "left" : "right" }; }));
    };

    const img = new Image();
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = MAP_W; off.height = MAP_H;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      land = g.getImageData(0, 0, MAP_W, MAP_H).data;
      draw();
    };
    img.src = "/images/site/world-land.png";
    document.fonts?.ready.then(draw, () => {});
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="hd-map" aria-hidden="true">
      <canvas ref={ref} className="hd-map__canvas" />
      {markers.map((m, i) => (
        <span key={m.id} className="hd-map__pin" style={{ left: m.x, top: m.y, ["--i" as string]: i }} data-side={m.side}>
          <i />
          <span className="hd-map__label"><b>{m.label}</b>{m.city}</span>
        </span>
      ))}
      <p className="hd-map__legend"><span className="hd-map__key hd-map__key--pin" />Chapters<span className="hd-map__key hd-map__key--cell" />Nonprofits we&apos;ve built for</p>
    </div>
  );
}
