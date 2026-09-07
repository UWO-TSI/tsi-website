"use client";

import { useGraphicsSettings } from "./useGraphicsSettings";

export function useGhostReplaySetting(): [boolean, (next: boolean) => void] {
  const [settings, actions] = useGraphicsSettings();
  return [settings.ghostsEnabled, actions.setGhostsEnabled];
}
