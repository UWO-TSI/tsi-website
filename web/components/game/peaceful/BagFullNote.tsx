"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { Backpack } from "lucide-react";
import s from "../BagHud.module.css";

/**
 * "Your backpack is full", over the spot a pickup didn't fit (specs/game-ui.md §5): the tree, rock, bug or water named
 * by `tsi:bag-full` { x, z }, for a couple of seconds. The item stays where it was.
 */
export default function BagFullNote({ ground }: { ground: (x: number, z: number) => number }) {
  const [note, setNote] = useState<{ x: number; z: number; id: number } | null>(null);
  useEffect(() => {
    let t = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ x?: number; z?: number }>).detail;
      if (typeof d?.x !== "number" || typeof d?.z !== "number") return;
      setNote({ x: d.x, z: d.z, id: Date.now() });
      window.clearTimeout(t);
      t = window.setTimeout(() => setNote(null), 2400);
    };
    window.addEventListener("tsi:bag-full", on);
    return () => { window.removeEventListener("tsi:bag-full", on); window.clearTimeout(t); };
  }, []);
  if (!note) return null;
  return <Html position={[note.x, ground(note.x, note.z) + 1.4, note.z]} center zIndexRange={[20, 0]}>
    <p key={note.id} className={s.fullNote} role="status"><Backpack size={16} aria-hidden /> Your backpack is full</p>
  </Html>;
}
