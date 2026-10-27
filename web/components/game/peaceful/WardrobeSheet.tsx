"use client";

/**
 * Wardrobe (decision 210): the same sheet opens from the closet at home and
 * the shop's fitting room. It is the character creator limited to hair, the
 * face parts (wardrobe batch 2 sells whole faces) and clothes, showing the real
 * character (A-sheet display: three-quarter view on a patterned backdrop).
 * Clothes, dyes and priced items come from /api/economy/inventory; the rest
 * show locked with a link to the shop (ruling on audit item 22). In the flat
 * UI's look (specs/polish/flat-ui.md round 3). Signed in, it also sets or changes your world name (row 222; the
 * arrival's creator is the only other place that asks, so an arrived player names themselves here).
 */
import { useMemo, useState } from "react";
import CharacterCreator from "../character/CharacterCreator";
import { useOwned } from "@/components/economy/EconomySheets";
import { saveMyLook, useMyLook } from "@/lib/game/character/lookStore";
import { STARTER_PARTS, openEventParts } from "@/lib/game/character/look";
import { useCostumeEventsOpen } from "@/lib/game/useTraditions";
import { usePresence } from "@/lib/game/useWorldDialog";
import { useWorldIdentity } from "@/lib/game/identity";
import { saveName } from "../character/PlayerCharacterUI";

/** How long the wardrobe takes to close (the creator's `presence` motion). */
export const WARDROBE_EXIT_MS = 200;

/**
 * Stays mounted: told `open`, it plays its close motion before it goes (audit-2026-10-ui item 4). Its inside (the
 * creator, its canvas, the inventory read) mounts only while it shows, fresh at each opening.
 */
export default function WardrobeSheet({ open, onClose, place, onShop }: { open: boolean; onClose: () => void; place: "closet" | "fitting"; onShop: () => void }) {
  const state = usePresence(open, WARDROBE_EXIT_MS);
  // Closing, it keeps its title: the parent no longer says which it was.
  const [kept, setKept] = useState(place);
  if (open && kept !== place) setKept(place);
  if (!state) return null;
  return <Wardrobe presence={state} place={open ? place : kept} onClose={onClose} onShop={onShop} />;
}

function Wardrobe({ presence, onClose, place, onShop }: { presence: "open" | "closing"; onClose: () => void; place: "closet" | "fitting"; onShop: () => void }) {
  const mine = useMyLook();
  const identity = useWorldIdentity();
  const inventory = useOwned();
  // Signed out (or still loading): the starter clothes, as a new account has. A running tradition's costumes are
  // everyone's while it lasts (the costume closet, lib/content/traditions.ts).
  const events = useCostumeEventsOpen();
  const owned = useMemo(() => new Set([...(inventory ? inventory.keys() : STARTER_PARTS), ...openEventParts(events)]), [inventory, events]);
  return <CharacterCreator flat mode="wardrobe" presence={presence} initial={mine.look} owned={owned} onShop={onShop} title={place === "closet" ? "Your closet" : "Fitting room"} onClose={onClose}
    askName={identity.signedIn ? { current: identity.display_name } : undefined}
    onDone={async (look, name) => { await saveMyLook(look); if (name) await saveName(name); onClose(); }} />;
}
