"use client";

import { useSyncExternalStore } from "react";

const query = "(max-width: 767px), (pointer: coarse), (prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useFormOnly() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
}
