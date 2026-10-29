"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { Backpack, Waves } from "lucide-react";
import { StatusChip } from "@/components/gui/flat/reel";
import s from "../BagHud.module.css";

/**
 * "Your backpack is full", over the spot a pickup didn't fit (specs/game-ui.md §5): the tree, rock, bug or water named
 * by `tsi:bag-full` { x, z }, for a couple of seconds. The item stays where it was. The same note says "Point at the
 * water" over you when a cast is aimed at land (`tsi:fish-aim`): the rod never throws onto the sand.
 */
export default function BagFullNote({ ground }: { ground: (x: number, z: number) => number }) {
  const [note, setNote] = useState<{ x: number; z: number; id: number; aim: boolean } | null>(null);
  useEffect(() => {
    let t = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ x?: number; z?: number }>).detail;
      if (typeof d?.x !== "number" || typeof d?.z !== "number") return;
      setNote({ x: d.x, z: d.z, id: Date.now(), aim: e.type === "tsi:fish-aim" });
      window.clearTimeout(t);
      t = window.setTimeout(() => setNote(null), 2400);
    };
    window.addEventListener("tsi:bag-full", on);
    window.addEventListener("tsi:fish-aim", on);
    return () => { window.removeEventListener("tsi:bag-full", on); window.removeEventListener("tsi:fish-aim", on); window.clearTimeout(t); };
  }, []);
  if (!note) return null;
  return <Html position={[note.x, ground(note.x, note.z) + (note.aim ? 2.4 : 1.4), note.z]} center zIndexRange={[20, 0]}>
    {note.aim ? <StatusChip key={note.id} icon={<Waves />}>Point at the water</StatusChip>
      : <p key={note.id} className={s.fullNote} role="status"><Backpack size={16} aria-hidden /> Your backpack is full</p>}
  </Html>;
}
