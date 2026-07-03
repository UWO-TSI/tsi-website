import type { ComponentType } from "react";
import { Sword, Sparkles, Heart, Wrench } from "lucide-react";

// Cosmetic class identity (ux-classes.md §1 + §4). Flair only — never gate
// features on class (design principle #4). Colors + icons match the oracle
// page's MBTI map: Warrior #EF4444 Sword, Mage #6366F1 Sparkles,
// Healer #22C55E Heart, Rogue #F59E0B Wrench.

interface ClassMeta {
  icon: ComponentType<{ className?: string; style?: React.CSSProperties; size?: number | string }>;
  color: string;
}

export const CLASS_META: Record<string, ClassMeta> = {
  Warrior: { icon: Sword, color: "#EF4444" },
  Mage: { icon: Sparkles, color: "#6366F1" },
  Healer: { icon: Heart, color: "#22C55E" },
  Rogue: { icon: Wrench, color: "#F59E0B" },
};

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
      className="inline-flex items-center gap-1 font-mono"
      style={{ color: meta.color, fontSize }}
    >
      <Icon aria-hidden style={{ width: iconSize, height: iconSize }} />
      {showName && cls}
    </span>
  );
}
