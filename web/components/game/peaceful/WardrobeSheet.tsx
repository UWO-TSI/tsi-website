"use client";

/**
 * Wardrobe (decision 210): the same sheet opens from the closet at home and
 * the shop's fitting room. It is the character creator limited to hair and
 * clothes, showing the real character (A-sheet display: three-quarter view on
 * a patterned backdrop). Clothes and dyes come from /api/economy/inventory;
 * the rest show locked with a link to the shop (ruling on audit item 22).
 */
import { useMemo } from "react";
import CharacterCreator from "../character/CharacterCreator";
import { useOwned } from "@/components/economy/EconomySheets";
import { saveMyLook, useMyLook } from "@/lib/game/character/lookStore";
import { STARTER_PARTS } from "@/lib/game/character/look";

export default function WardrobeSheet({ open, onClose, place, onShop }: { open: boolean; onClose: () => void; place: "closet" | "fitting"; onShop: () => void }) {
  const mine = useMyLook();
  const inventory = useOwned();
  // Signed out (or still loading): the starter clothes, as a new account has.
  const owned = useMemo(() => new Set(inventory ? inventory.keys() : STARTER_PARTS), [inventory]);
  if (!open) return null;
  return <CharacterCreator mode="wardrobe" initial={mine.look} owned={owned} onShop={onShop} title={place === "closet" ? "Your closet" : "Fitting room"} onClose={onClose}
    onDone={async look => { await saveMyLook(look); onClose(); }} />;
}
