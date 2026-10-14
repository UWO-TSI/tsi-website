/**
 * Name tags (specs/v1-drop.md §3, decided with David 2026-10-13): small clean text with a soft shadow, no plate, over the
 * other players and the residents within about 8 steps of you. Your own name never shows. A TSI member's name has a tiny
 * blue dot; residents' names are a warmer colour (components/game/nameTags.module.css).
 *
 * Every tag is a label in the world's layout (lib/game/labelLayout.ts), so a resident's name steps up out of a player's
 * (players rank above residents) or waits while there's no room, and none hangs on a wall in front of it. The other
 * players' tags are pooled (components/game/net/Nameplates.tsx); a resident's sits in its drei `<Html>` stack under
 * their bubble and "!", and the layout only shows, fades and nudges it (`residentTag`).
 */
import type * as THREE from "three";
import { LABEL_PRIORITY, type LabelSpec } from "./labelLayout";

/** How near a name shows: about 8 steps (world units, along the ground), fading over the layout's FADE_RUN past it. */
export const NAME_TAG_RANGE = 8;

/** The parts of a tag's element the layout writes (an HTMLElement; tests pass a stand-in). */
export interface TagElement {
  hidden: boolean;
  style: { opacity: string; transform: string };
  getBoundingClientRect(): { width: number; height: number };
}

/**
 * A resident's (or a keeper's) name as a label: shown within NAME_TAG_RANGE of you while `anchor` writes its point (the
 * owner returns false during a talk, while their bubble carries the name, or while they're out of sight), faded by the
 * layout's range and occlusion, nudged up out of a player's tag, hidden when squeezed out. drei places the element
 * itself; this only writes `hidden`, the opacity and the nudge, each when it changes. Measured once, the first time
 * it shows (a resident's name doesn't change while they stand there).
 */
export function residentTag(anchor: (out: THREE.Vector3) => boolean, el: () => TagElement | null): LabelSpec {
  const size = { w: 0, h: 0 };
  let measured = false, alpha = 1, dy = 0;
  return {
    priority: LABEL_PRIORITY.resident, size, range: NAME_TAG_RANGE,
    anchor,
    place: o => {
      const e = el();
      if (!e) return;
      // Its box before anything else (a box of 0 would read as squeezed out for good): shown for the measure if need be.
      if (o.shown && !measured) {
        measured = true;
        e.hidden = false;
        const b = e.getBoundingClientRect();
        size.w = b.width; size.h = b.height;
      }
      const on = o.shown && !o.dot;
      if (e.hidden === on) e.hidden = !on;
      if (!on) return;
      const a = Math.round(o.alpha * 50) / 50;
      if (a !== alpha) { alpha = a; e.style.opacity = a < 1 ? String(a) : ""; }
      const y = Math.round(o.dy);
      if (y !== dy) { dy = y; e.style.transform = y ? `translateY(${y}px)` : ""; }
    },
  };
}
