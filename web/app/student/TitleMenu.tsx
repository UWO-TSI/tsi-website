"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import s from "./TitleScreen.module.css";

export type TitleAction = "play" | "settings" | "exit";
export type TitleMenuItem = { id: TitleAction; label: string };

/** The title's three choices (specs/v1-drop.md §8b, after `title-piece-by-piece-ref.png`). */
export const TITLE_MENU: readonly TitleMenuItem[] = [
  { id: "play", label: "Let's Play" },
  { id: "settings", label: "Settings" },
  { id: "exit", label: "Exit" },
];

const NEXT = new Set(["ArrowDown", "s", "S"]), PREV = new Set(["ArrowUp", "w", "W"]);

/** Where a key moves the selection: the arrows (and W/S) wrap, Home and End jump; null for keys the menu leaves to the buttons. */
export function menuMove(selected: number, key: string, count: number): number | null {
  if (NEXT.has(key)) return (selected + 1) % count;
  if (PREV.has(key)) return (selected - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * The cream card's list: one tab stop (the selected item: a roving tab index), the arrows move it and its focus, the
 * pointer selects what it rests on, Enter or Space picks. It takes focus when it mounts, on the item it was left on, so
 * coming back from Settings lands on Settings.
 */
export default function TitleMenu({ items, selected, onSelected, onPick, caption }: {
  items: readonly TitleMenuItem[]; selected: number; onSelected: (i: number) => void; onPick: (id: TitleAction) => void; caption?: string | null;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { refs.current[selected]?.focus({ preventScroll: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- on mount only
  const onKey = (e: KeyboardEvent) => {
    const next = menuMove(selected, e.key, items.length);
    if (next === null) return;
    e.preventDefault();
    onSelected(next);
    refs.current[next]?.focus();
  };
  return (
    <nav aria-label="Main menu" onKeyDown={onKey}>
      {caption && <p className={s.caption}>{caption}</p>}
      <ul className={s.menu}>
        {items.map((item, i) => (
          <li key={item.id}>
            <button ref={el => { refs.current[i] = el; }} type="button" tabIndex={i === selected ? 0 : -1} data-selected={i === selected || undefined}
              onMouseEnter={() => onSelected(i)} onFocus={() => onSelected(i)} onClick={() => onPick(item.id)}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
