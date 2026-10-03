import type { ComponentType } from "react";
import { Sword, Sparkles, Heart, Wrench } from "lucide-react";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";

// Cosmetic class identity: profiles.class holds the Oracle family (034).
// Flair only, never gate features on class (design principle #4). Colours
// come from FAMILIES; icons carry over from the old four classes.

interface ClassMeta {
  icon: ComponentType<{ className?: string; style?: React.CSSProperties; size?: number | string }>;
  color: string;
}

const ICONS: Record<Family, ClassMeta["icon"]> = { Arcane: Sparkles, Ranger: Wrench, Vanguard: Sword, Warden: Heart };

export const CLASS_META: Record<string, ClassMeta> = Object.fromEntries(
  (Object.keys(FAMILIES) as Family[]).map((f) => [f, { icon: ICONS[f], color: FAMILIES[f].color }]),
);

/**
 * Inline icon + class name, class-colored. Renders nothing for unknown /
 * missing classes so callers can use it unconditionally.
 */
export function ClassBadge({
  cls,
  iconSize = 12,
  fontSize = 12,
  showName = true,
}: {
  cls: string | null | undefined;
  iconSize?: number;
  fontSize?: number;
  showName?: boolean;
}) {
  const meta = cls ? CLASS_META[cls] : undefined;
  if (!meta || !cls) return null;
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 "
      style={{ color: meta.color, fontSize }}
    >
      <Icon aria-hidden style={{ width: iconSize, height: iconSize }} />
      {showName && cls}
    </span>
  );
}
