"use client";

/**
 * The space around the rooms (David, 2026-10-17): Tethos-branded dark. Deep charcoal with a subtle grain, the Tethos
 * mark tiled faintly and drifting very slowly, a soft vignette, and a slight tint for each building. Plain CSS in a
 * layer behind the canvas, so it costs no draws: the room clears to transparent around itself
 * (applyInteriorBackdrop(scene, null)) and this shows through. The drift stops for reduced motion.
 */
import type { CSSProperties } from "react";
import s from "./InteriorBackdrop.module.css";

export type BackdropRoom = "shop" | "hq" | "museum" | "wharf" | "cafe";
/** Each building's slight tint in the dark: sage for the shop, navy for the museum, warm brown for HQ. */
export const BACKDROP_TINT: Record<BackdropRoom, string> = {
  shop: "#3d5a4a",
  museum: "#26345a",
  hq: "#4f3826",
  wharf: "#24404f",
  cafe: "#553623",
};

export default function InteriorBackdrop({ room }: { room: BackdropRoom }) {
  return <div className={s.backdrop} style={{ "--tint": BACKDROP_TINT[room] } as CSSProperties} aria-hidden data-testid="interior-backdrop" data-room={room} />;
}
