"use client";

import { useCallback, useRef, useState } from "react";
import { rotate, type HomeLayoutDoc, type PlacedItem, type Rotation } from "@/lib/homes/layout";

/** Where an item lives: a room (by index) or outdoors on the home island. */
export type HomeSpot = number | "outdoor";
export interface Selection { piece: string; rot: Rotation; uid?: string }

function withItem(doc: HomeLayoutDoc, spot: HomeSpot, item: PlacedItem): HomeLayoutDoc {
  const put = (items: PlacedItem[]) => [...items.filter(i => i.uid !== item.uid), item];
  if (spot === "outdoor") return { ...doc, outdoor: put(doc.outdoor) };
  return { ...doc, rooms: doc.rooms.map((room, i) => (i === spot ? { ...room, items: put(room.items) } : room)) };
}
function withoutItem(doc: HomeLayoutDoc, spot: HomeSpot, uid: string): HomeLayoutDoc {
  if (spot === "outdoor") return { ...doc, outdoor: doc.outdoor.filter(i => i.uid !== uid) };
  return { ...doc, rooms: doc.rooms.map((room, i) => (i === spot ? { ...room, items: room.items.filter(it => it.uid !== uid) } : room)) };
}

/**
 * Decorate mode state (specs/homes.md §3): choose a catalogue piece, rotate
 * in 90° steps, place, pick up an existing piece (Esc puts it back where it
 * was), put away, and swap wallpaper/flooring. Writes through `setLayout`.
 */
export function useDecorate(layout: HomeLayoutDoc, setLayout: (next: HomeLayoutDoc) => void, initial: { on: boolean; piece: string | null }) {
  const [decorating, setDecorating] = useState(initial.on);
  const [selected, setSelected] = useState<Selection | null>(initial.piece ? { piece: initial.piece, rot: 0 } : null);
  const held = useRef<{ spot: HomeSpot; item: PlacedItem } | null>(null);
  const cancel = useCallback(() => {
    if (held.current) setLayout(withItem(layout, held.current.spot, held.current.item));
    held.current = null;
    setSelected(null);
  }, [layout, setLayout]);
  return {
    decorating, selected,
    toggle: () => { if (decorating) cancel(); setDecorating(!decorating); },
    choose: (piece: string) => { cancel(); setSelected({ piece, rot: 0 }); },
    rotateSelected: () => setSelected(s => (s ? { ...s, rot: rotate(s.rot) } : s)),
    place: (spot: HomeSpot, item: PlacedItem) => { setLayout(withItem(layout, spot, item)); held.current = null; setSelected(null); },
    pickUp: (spot: HomeSpot, item: PlacedItem) => {
      setLayout(withoutItem(layout, spot, item.uid));
      held.current = { spot, item };
      setSelected({ piece: item.piece, rot: item.rot, uid: item.uid });
    },
    putAway: () => { held.current = null; setSelected(null); },
    cancel,
    setRoomFinish: (room: number, key: "wallpaper" | "flooring", value: string) =>
      setLayout({ ...layout, rooms: layout.rooms.map((r, i) => (i === room ? { ...r, [key]: value } : r)) }),
  };
}
