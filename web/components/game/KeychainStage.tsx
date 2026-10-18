"use client";

/**
 * The keycap keychain in the shop's detail view (specs/merch/tsi-keycap-keychain.md): hanging in the middle of the
 * turning stage with the pixel finish (TurnStage); drag turns it, and a tap on the keycap presses it with its click.
 * Where the 3D can't run (lite graphics, or the canvas failing) its sprite shows instead: the icon, a render of the
 * same model, large and pixelated.
 */
import { Component, Suspense, type ReactNode } from "react";
import TurnStage, { useStageTap } from "@/components/economy/TurnStage";
import PixelImage from "@/components/economy/PixelImage";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { iconUrl } from "@/lib/icons/keys";
import KeycapKeychain from "./KeycapKeychain";

export const KEYCHAIN_SLUG = "merch-tsi-keycap-keychain";
const SPRITE = iconUrl(KEYCHAIN_SLUG);

function Hanging() {
  const arm = useStageTap();
  // Centred on the stage: it hangs 1.08 (model units) from its hook.
  return <KeycapKeychain scale={1.45} position={[0, 0.78, 0]} onKeycapDown={press => arm(press)} />;
}

/** The sprite when the 3D fails to start. */
class Fallback extends Component<{ sprite: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.sprite : this.props.children; }
}

export default function KeychainStage({ className, pictureClassName }: { className?: string; pictureClassName?: string }) {
  const [{ liteMode }] = useGraphicsSettings();
  const sprite = <div className={className}><PixelImage src={SPRITE} px={72} className={pictureClassName} label="TSI keycap keychain" /></div>;
  if (liteMode) return sprite;
  return <Fallback sprite={sprite}>
    <TurnStage className={className} label="TSI keycap keychain" cameraZ={4.4}><Suspense fallback={null}><Hanging /></Suspense></TurnStage>
  </Fallback>;
}
