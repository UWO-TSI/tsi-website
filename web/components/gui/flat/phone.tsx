"use client";

/**
 * The phone (design bible UI 8d). Round 9 (David on the UI view's bar: "pressing a button and a phone pops up on the
 * bottom right and the apps are like all the stuff in the bar so that we dont need the bottom bar anymore"); round 10
 * (David, 2026-11-04: "phone model, make it 3d blender with a slide up animation"): a cream and mint slider phone,
 * modelled in Blender (art/ui/slider_phone.py) and shown as three rendered layers, the body with its keypad, the
 * sliding top half and the strap's jelly star, moved in CSS. It comes up from the bottom right, the top half slides up
 * to show the keypad, and putting it away plays that back. Round 11 (David: "the phone also needs a pixel filter",
 * "phone ui reference, change color but keep the pixel-y style"): the layers are drawn small and scaled up without
 * smoothing at the world's pixel size (PX, the pixel finish), every box on that one grid, and the screen is live HTML in
 * pixel art (pixel.tsx): a 9-slice frame, a title pill, square app tiles, a pointing hand on the selected app and the
 * home button. An app opens its own sheet while the phone tucks down out of the way (`away`). Colours: the theme's
 * --ui-* tokens. Plain props; nothing here knows the game. Shown on /lab/gui?only=phone.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Counter } from "@/components/gui";
import { usePresence } from "@/lib/game/useWorldDialog";
import { PHONE_ART as A } from "./phoneArt";
import { ICON, PX, SPRITES, spriteUrl } from "./pixel";
import p from "./phone.module.css";

export interface PhoneApp {
  id: string; label: string; icon: ReactNode;
  /** The key that opens it from the world (not shown on a touch screen). */
  keyLabel?: string;
  /** New things inside (letters, friend asks). */
  badge?: number;
  onOpen: () => void;
}

/** The slide back down and the drop, so the parent's closing state waits for both (ms). */
const OUT_MS = 400;

type Box = readonly [number, number, number, number];
type LayerName = keyof typeof A.layers;
const [CW, CH] = A.canvas;
const S = A.screen;
/** The open phone's height above the bottom edge, in bodies (the keypad's foot, a fifth of the body, hangs below it). */
const TALL = CH / A.body - 0.2;

/**
 * The phone on the pixel grid: everything in world pixels (PX CSS px each) for a phone `nw` pixels wide. The layers,
 * the slide, the strap's pivot and the screen are the render's (phoneArt.ts) rounded to whole pixels; the screen's app
 * tiles are as big as three fit across it (the 12-pixel icons, a border and a gap) and two rows down it.
 */
export function phoneLayout(nw: number) {
  const k = nw / CW;
  const box = ([x, y, w, h]: readonly number[]): Box => {
    const x0 = Math.round(x * k), y0 = Math.round(y * k);
    return [x0, y0, Math.round((x + w) * k) - x0, Math.round((y + h) * k) - y0];
  };
  const screen = box([S.tl[0], S.tl[1], S.tr[0] - S.tl[0], S.bl[1] - S.tl[1]]);
  const [, , sw, sh] = screen;
  // Across: the frame (3 a side) and a pixel's room, two gaps of 2. Down: the title (10), the home button (9), the
  // rows' gap (3), and under each tile its label (7).
  const tile = Math.max(ICON + 4, Math.min(Math.floor((sw - 8 - 4) / 3), Math.floor((sh - 19 - 3 - 14) / 2)));
  return {
    w: nw, h: Math.round(CH * k), screen, tile,
    layers: { base: box(A.layers.base), top: box(A.layers.top), charm: box(A.layers.charm) },
    slide: [Math.round(A.slide[0] * k), Math.round(A.slide[1] * k)] as const,
    pivot: [Math.round(A.pivot[0] * k), Math.round(A.pivot[1] * k)] as const,
  };
}
type Layout = ReturnType<typeof phoneLayout>;

const src = (name: LayerName) => `/assets/ui/phone/${name}.webp`;
const images: Partial<Record<LayerName, Promise<HTMLImageElement>>> = {};
const load = (name: LayerName) => (images[name] ??= new Promise(done => {
  const img = new Image(); img.onload = img.onerror = () => done(img); img.src = src(name);
}));

/**
 * One rendered layer on the grid. With the pixel finish it is drawn one canvas pixel a world pixel, averaged down, its
 * edge made hard (as the world's are: no antialiasing), and shown scaled up without smoothing; without the finish, at
 * the screen's own resolution.
 */
function Layer({ name, at, pixelated, className, style }: { name: LayerName; at: Box; pixelated: boolean; className: string; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [x, y, w, h] = at;
  useEffect(() => {
    let live = true;
    void load(name).then(img => {
      const c = ref.current;
      if (!live || !c || !img.naturalWidth) return;
      const s = pixelated ? 1 : PX * window.devicePixelRatio;
      c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      const g = c.getContext("2d", { willReadFrequently: pixelated });
      if (!g) return;
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      if (!pixelated) return;
      const d = g.getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 128 ? 0 : 255;
      g.putImageData(d, 0, 0);
    });
    return () => { live = false; };
  }, [name, w, h, pixelated]);
  return <canvas ref={ref} className={`${p.layer} ${className}`} aria-hidden="true"
    style={{ left: x * PX, top: y * PX, width: w * PX, height: h * PX, imageRendering: pixelated ? "pixelated" : "auto", ...style }} />;
}

const BOX = { "--px": `${PX}px`, "--phone-ratio": CW / A.body, "--phone-tall": TALL, aspectRatio: `${CW} / ${CH}` } as CSSProperties;

export function Phone({ open, apps, away, hint, onClose, pixelated = true, testId = "phone" }: {
  open: boolean; apps: readonly PhoneApp[];
  /** An app is open: the phone tucks down out of the way until it closes. */
  away?: boolean;
  /** Beside the home button: what puts it away (its key). */
  hint?: ReactNode;
  /** The home button: put the phone away. */
  onClose: () => void;
  /** The world's pixel finish is on: the phone's body is drawn at its pixel size too (the screen always is). */
  pixelated?: boolean;
  testId?: string;
}) {
  const state = usePresence(open, OUT_MS);
  const ref = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [sprites, setSprites] = useState<CSSProperties>({});
  // The layers are small (about 70 KB): fetch them before the first open, so it never comes up blank.
  useEffect(() => { for (const n of ["base", "top", "charm"] as const) void load(n); }, []);
  const shown = !!state;
  // Measured before the first paint: the phone's width (CSS sets it, a whole number of pixels) gives the grid, and the
  // pixel art is drawn in the theme's colours as it comes up.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    setSprites(Object.fromEntries(Object.entries(SPRITES).map(([k, rows]) => [`--px-${k}`, spriteUrl(rows, el)])) as CSSProperties);
    const measure = () => { const nw = Math.round(el.clientWidth / PX); setLayout(l => (l?.w === nw ? l : phoneLayout(nw))); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);
  if (!state) return null;
  const L = layout;
  const at = (b: Box): CSSProperties => ({ left: b[0] * PX, top: b[1] * PX, width: b[2] * PX, height: b[3] * PX });
  const grid = L && { ...BOX, ...sprites, height: L.h * PX, "--slide": `${L.slide[0] * PX}px ${L.slide[1] * PX}px`, "--t": L.tile } as CSSProperties;
  return <nav ref={ref} className={`${p.phone} gui`} style={grid ?? BOX} data-gui-flat="" data-state={state} data-away={away || undefined} aria-label="Phone" aria-hidden={away || undefined} data-testid={testId}>
    {L && <>
      <Layer name="base" at={L.layers.base} pixelated={pixelated} className={p.base} />
      <div className={p.slider}>
        <Layer name="charm" at={L.layers.charm} pixelated={pixelated} className={p.charm}
          style={{ transformOrigin: `${(L.pivot[0] - L.layers.charm[0]) * PX}px ${(L.pivot[1] - L.layers.charm[1]) * PX}px` }} />
        <Layer name="top" at={L.layers.top} pixelated={pixelated} className={p.top} />
        <div className={p.screen} style={at(L.screen)}>
          <span className={p.title} aria-hidden="true"><i /><i /><i /></span>
          <div className={p.grid}>
            {apps.map(a => <button key={a.id} type="button" className={p.app} onClick={a.onOpen} tabIndex={away ? -1 : undefined}
              aria-label={a.badge ? `${a.label}, ${a.badge} new` : a.label} title={a.keyLabel ? `${a.label} (${a.keyLabel})` : a.label}>
              <span className={p.tile} aria-hidden="true">{a.icon}<Counter n={a.badge ?? 0} className={p.badge} />{a.keyLabel && <kbd>{a.keyLabel}</kbd>}</span>
              <span className={p.label}>{a.label}</span>
            </button>)}
          </div>
          <button type="button" className={p.home} onClick={onClose} tabIndex={away ? -1 : undefined} aria-label="Put the phone away">
            <i aria-hidden="true" />{hint}
          </button>
        </div>
      </div>
    </>}
  </nav>;
}
