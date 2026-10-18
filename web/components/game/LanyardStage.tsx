"use client";

/**
 * The TSI lanyard in the shop's detail view (specs/merch/tsi-lanyard.md): hanging in the middle of the turning stage with
 * the pixel finish (TurnStage), so both printed sides come round; drag turns it. A button switches between the print
 * close up and the whole lanyard. Where the 3D can't run (lite graphics,
 * or the canvas failing) its sprite shows instead: the icon, a render of the same model, large and pixelated.
 */
import { Component, Suspense, useState, type ReactNode } from "react";
import TurnStage from "@/components/economy/TurnStage";
import PixelImage from "@/components/economy/PixelImage";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { iconUrl } from "@/lib/icons/keys";
import Lanyard, { LANYARD_HANG, LANYARD_SLUG } from "./Lanyard";
import s from "./KeychainStage.module.css";

const SPRITE = iconUrl(LANYARD_SLUG);
/**
 * Close up (the default): the neck and the strands' upper half large enough for the print to read through the pixel
 * finish, turning so both sides come round. Whole: all of it, 1.57 tall like the keychain, the D-ring and the hook.
 */
const CLOSE = { scale: 1.1, at: [0, 0.93, 0] as [number, number, number] };
const WHOLE = { scale: 1.57 / LANYARD_HANG, at: [0, 0.78, 0] as [number, number, number] };

/** The sprite when the 3D fails to start. */
class Fallback extends Component<{ sprite: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.sprite : this.props.children; }
}

export default function LanyardStage({ className, pictureClassName }: { className?: string; pictureClassName?: string }) {
  const [{ liteMode }] = useGraphicsSettings();
  const [whole, setWhole] = useState(false);
  const view = whole ? WHOLE : CLOSE;
  const sprite = <div className={className}><PixelImage src={SPRITE} px={72} className={pictureClassName} label="TSI lanyard" /></div>;
  if (liteMode) return sprite;
  return <Fallback sprite={sprite}>
    <TurnStage className={className} label="TSI lanyard" cameraZ={4.4}>
      <Suspense fallback={null}><Lanyard scale={view.scale} position={view.at} still /></Suspense>
    </TurnStage>
    <button type="button" className={s.capButton} aria-pressed={whole} onClick={() => setWhole(v => !v)} data-testid="lanyard-whole">
      {whole ? "Close up" : "See it whole"}
    </button>
  </Fallback>;
}
