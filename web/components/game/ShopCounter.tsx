"use client";

/**
 * The shop's counter (specs/interiors/shop.md): E at the counter in the shop, the shopkeeper asks what you're after
 * (ShopkeeperChoice) and the shop overlay opens on that answer (ShopOverlay): the game's things, with Sell for what's
 * in your bag, or the club merch. The shopkeeper serves you from behind the counter (ShopInterior's resident) and has a
 * word about each sale. Coins and Gems only, one price an item, never money (lib/economy.ts).
 */
import ShopOverlay from "@/components/economy/ShopOverlay";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import type { ShopEntry } from "@/lib/wallet/service";
import { loadBag } from "@/lib/game/bagStore";
import KeychainStage, { KEYCHAIN_SLUG } from "./KeychainStage";
import LanyardStage from "./LanyardStage";
import { LANYARD_SLUG } from "./Lanyard";
import type { ShopSection } from "./ShopkeeperChoice";

/** The shopkeeper's word on it, said behind the counter (ShopInterior's Keeper listens). */
/** Merch with a model of its own in the detail view: the keycap keychain (it hangs, turns and clicks), the lanyard. */
export const merchViewer = (e: ShopEntry, className: string, pictureClassName: string) =>
  e.slug === KEYCHAIN_SLUG ? <KeychainStage className={className} pictureClassName={pictureClassName} />
    : e.slug === LANYARD_SLUG ? <LanyardStage className={className} pictureClassName={pictureClassName} /> : null;

const say = (line: string, clip: "Wave" | "Chat" = "Chat") => window.dispatchEvent(new CustomEvent("tsi:shopkeeper-say", { detail: { line, clip } }));

export default function ShopCounter({ open, onClose, transport = httpEconomyTransport, section }: {
  open: boolean; onClose: () => void; transport?: EconomyTransport;
  /** The shopkeeper's answer (ShopkeeperChoice): the game's things, or the real club merch. */
  section?: ShopSection;
}) {
  return <ShopOverlay open={open} onClose={onClose} keys="e" transport={transport} section={section} sell={section !== "merch"} viewerFor={merchViewer}
    title={section === "merch" ? "Club merch" : "The shop"}
    onBought={(_, line) => say(line, "Wave")}
    onSold={(line, ok) => { say(line, ok ? "Wave" : "Chat"); if (ok) void loadBag(); }} />;
}
