"use client";

/**
 * The phone (design bible UI 8d). Round 9 (David on the UI view's bar: "pressing a button and a phone pops up on the
 * bottom right and the apps are like all the stuff in the bar so that we dont need the bottom bar anymore"); round 10
 * (David, 2026-11-04: "phone model, make it 3d blender with a slide up animation"): a cream and mint slider phone,
 * modelled in Blender (art/ui/slider_phone.py) and shown as three rendered layers, the body with its keypad, the
 * sliding top half and the strap's jelly star, moved in CSS. It comes up from the bottom right, the top half slides up
 * to show the keypad, and putting it away plays that back. The screen is live HTML laid over the rendered glass with
 * one CSS matrix (the render is orthographic, so the glass is an affine map of a flat rectangle): the app grid, each
 * app opening its own sheet while the phone tucks down out of the way (`away`), and the home bar that puts it away.
 * Colours: the theme's --ui-* tokens. Plain props; nothing here knows the game. Shown on /lab/gui?only=phone.
 */
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Counter } from "@/components/gui";
import { usePresence } from "@/lib/game/useWorldDialog";
import { PHONE_ART as A } from "./phoneArt";
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

// Where the rendered layers sit, as shares of the render canvas (the open phone's bounds; phoneArt.ts).
const [CW, CH] = A.canvas;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const src = (name: keyof typeof A.layers) => `/assets/ui/phone/${name}.webp`;
const layer = (name: keyof typeof A.layers): CSSProperties => {
  const [x, y, w, h] = A.layers[name];
  return { left: pct(x, CW), top: pct(y, CH), width: pct(w, CW), height: pct(h, CH), backgroundImage: `url(${src(name)})` };
};
const S = A.screen, [SW, SH] = S.size;
const BOX = { "--phone-ratio": CW / A.body, aspectRatio: `${CW} / ${CH}`, "--slide": `${pct(A.slide[0], CW)} ${pct(A.slide[1], CH)}` } as CSSProperties;
const SCREEN: CSSProperties = {
  left: pct(S.tl[0], CW), top: pct(S.tl[1], CH), width: pct(SW, CW), height: pct(SH, CH),
  transform: `matrix(${(S.tr[0] - S.tl[0]) / SW}, ${(S.tr[1] - S.tl[1]) / SW}, ${(S.bl[0] - S.tl[0]) / SH}, ${(S.bl[1] - S.tl[1]) / SH}, 0, 0)`,
  borderRadius: `${pct(S.radius, SW)} / ${pct(S.radius, SH)}`,
};
const CHARM: CSSProperties = { ...layer("charm"), transformOrigin: `${pct(A.pivot[0] - A.layers.charm[0], A.layers.charm[2])} ${pct(A.pivot[1] - A.layers.charm[1], A.layers.charm[3])}` };

export function Phone({ open, apps, away, hint, onClose, testId = "phone" }: {
  open: boolean; apps: readonly PhoneApp[];
  /** An app is open: the phone tucks down out of the way until it closes. */
  away?: boolean;
  /** Beside the home bar: what puts it away (its key). */
  hint?: ReactNode;
  /** The home bar: put the phone away. */
  onClose: () => void;
  testId?: string;
}) {
  const state = usePresence(open, OUT_MS);
  // The layers are small (about 75 KB): fetch them before the first open, so it never comes up blank.
  useEffect(() => { for (const n of ["base", "top", "charm"] as const) new Image().src = src(n); }, []);
  if (!state) return null;
  return <nav className={`${p.phone} gui`} style={BOX} data-gui-flat="" data-state={state} data-away={away || undefined} aria-label="Phone" aria-hidden={away || undefined} data-testid={testId}>
    <div className={`${p.layer} ${p.base}`} style={layer("base")} aria-hidden="true" />
    <div className={p.slider}>
      <div className={`${p.layer} ${p.charm}`} style={CHARM} aria-hidden="true" />
      <div className={`${p.layer} ${p.top}`} style={layer("top")} aria-hidden="true" />
      <div className={p.screen} style={SCREEN}>
        <div className={p.inner}>
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
    </div>
  </nav>;
}
