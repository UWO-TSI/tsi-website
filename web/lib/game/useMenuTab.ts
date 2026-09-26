/** Next/previous-tab menu keys (row 220 remap): the island dispatches `tsi:menu-tab`; tabbed sheets cycle. */
import { useEffect, useRef } from "react";

export function useMenuTab<T>(active: boolean, tabs: readonly T[], current: T, select: (tab: T) => void): void {
  const state = useRef({ tabs, current, select });
  useEffect(() => { state.current = { tabs, current, select }; });
  useEffect(() => {
    if (!active) return;
    const on = (e: Event) => {
      const { tabs, current, select } = state.current;
      const step = (e as CustomEvent<{ step: number }>).detail.step;
      select(tabs[(tabs.indexOf(current) + step + tabs.length) % tabs.length]);
    };
    window.addEventListener("tsi:menu-tab", on);
    return () => window.removeEventListener("tsi:menu-tab", on);
  }, [active]);
}
