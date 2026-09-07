"use client";

import { useGraphicsSettings } from "./useGraphicsSettings";

export function useLiteMode(): [boolean, (next: boolean) => void] {
  const [settings, actions] = useGraphicsSettings();
  return [settings.liteMode, actions.setLiteMode];
}
