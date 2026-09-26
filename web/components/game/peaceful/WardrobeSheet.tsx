"use client";

/**
 * Wardrobe (decision 210): the same sheet opens from the closet at home and
 * the shop's fitting room. It is the character creator limited to hair and
 * clothes, showing the real character (A-sheet display: three-quarter view on
 * a patterned backdrop). Everything in the catalogue counts as owned until
 * clothing joins the inventory.
 */
import CharacterCreator from "../character/CharacterCreator";
import { saveMyLook, useMyLook } from "@/lib/game/character/lookStore";

export default function WardrobeSheet({ open, onClose, place }: { open: boolean; onClose: () => void; place: "closet" | "fitting" }) {
  const mine = useMyLook();
  if (!open) return null;
  return <CharacterCreator mode="wardrobe" initial={mine.look} title={place === "closet" ? "Your closet" : "Fitting room"} onClose={onClose}
    onDone={async look => { await saveMyLook(look); onClose(); }} />;
}
