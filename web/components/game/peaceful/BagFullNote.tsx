"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { Backpack, Waves, Wind } from "lucide-react";
import { StatusChip } from "@/components/gui/flat/reel";
import s from "../BagHud.module.css";

/**
 * "Your backpack is full", over the spot a pickup didn't fit (specs/game-ui.md §5): the tree, rock, bug or water named
 * by `tsi:bag-full` { x, z }, for a couple of seconds. The item stays where it was. "It got away!" over a bug that
 * fled (`tsi:bug-fled` { x, z }, m2: you learn what scared it). And "Point at the water" over you when a cast is aimed
 * at land (`tsi:fish-aim`): the rod never throws onto the sand.
 */
const NOTES = { "tsi:bag-full": { text: "Your backpack is full", Icon: Backpack, warn: true }, "tsi:bug-fled": { text: "It got away!", Icon: Wind, warn: false }, "tsi:fish-aim": { text: "Point at the water", Icon: Waves, warn: false } } as const;
export default function BagFullNote({ ground }: { ground: (x: number, z: number) => number }) {
  const [note, setNote] = useState<{ x: number; z: number; id: number; kind: keyof typeof NOTES } | null>(null);
  useEffect(() => {
    let t = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ x?: number; z?: number }>).detail;
      if (typeof d?.x !== "number" || typeof d?.z !== "number") return;
      setNote({ x: d.x, z: d.z, id: Date.now(), kind: e.type as keyof typeof NOTES });
      window.clearTimeout(t);
      t = window.setTimeout(() => setNote(null), 2400);
    };
    for (const k of Object.keys(NOTES)) window.addEventListener(k, on);
    return () => { for (const k of Object.keys(NOTES)) window.removeEventListener(k, on); window.clearTimeout(t); };
  }, []);
  if (!note) return null;
  const aim = note.kind === "tsi:fish-aim";
  const { text, Icon, warn } = NOTES[note.kind];
  return <Html position={[note.x, ground(note.x, note.z) + (aim ? 2.4 : 1.4), note.z]} center zIndexRange={[20, 0]}>
    {aim ? <StatusChip key={note.id} icon={<Waves />}>{text}</StatusChip>
      : <p key={note.id} className={s.fullNote} data-calm={warn ? undefined : ""} role="status"><Icon size={16} aria-hidden /> {text}</p>}
  </Html>;
}
