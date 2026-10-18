"use client";

/**
 * The GENESIS sticker in the shop's detail view (specs/merch/genesis-sticker.md): the card rocking slowly side to side
 * in the middle of the stage with the pixel finish (TurnStage's sway: a flat card never shows its back for long); drag
 * tilts it, so its holographic foil shifts. Its two
 * variants (light and dark) are thumbnails down the left of the stage. Where the 3D can't run (lite graphics, or the
 * canvas failing) the picked variant's sprite shows instead, its sheen baked in.
 */
import { Component, Suspense, useState, type ReactNode } from "react";
import TurnStage from "@/components/economy/TurnStage";
import PixelImage from "@/components/economy/PixelImage";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import GenesisSticker, { STICKER_VARIANTS, type StickerVariant } from "./GenesisSticker";
import s from "./StickerStage.module.css";

/** The sprite when the 3D fails to start. */
class Fallback extends Component<{ sprite: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.sprite : this.props.children; }
}

export default function StickerStage({ className, pictureClassName }: { className?: string; pictureClassName?: string }) {
  const [{ liteMode }] = useGraphicsSettings();
  const [variant, setVariant] = useState<StickerVariant>("light");
  const picked = STICKER_VARIANTS.find(v => v.id === variant)!;
  const swatches = <div className={s.swatches} role="radiogroup" aria-label="Variant">
    {STICKER_VARIANTS.map(v => <button key={v.id} type="button" className={s.swatch} aria-pressed={v.id === variant} aria-label={`${v.label} variant`}
      onClick={() => setVariant(v.id)} data-testid={`sticker-${v.id}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small pixel thumbnail */}
      <img src={v.sprite} alt="" />
    </button>)}
  </div>;
  const sprite = <div className={className}><PixelImage src={picked.sprite} px={96} className={pictureClassName} label={`GENESIS sticker, ${picked.label.toLowerCase()}`} /></div>;
  if (liteMode) return <>{sprite}{swatches}</>;
  return <>
    <Fallback sprite={sprite}>
      <TurnStage className={className} label={`GENESIS sticker, ${picked.label.toLowerCase()}`} cameraZ={4.2} sway={0.55}>
        <Suspense fallback={null}><GenesisSticker variant={variant} scale={2.0} /></Suspense>
      </TurnStage>
    </Fallback>
    {swatches}
  </>;
}
