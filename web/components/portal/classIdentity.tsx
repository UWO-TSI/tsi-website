import type { ComponentType } from "react";
import { Sword, Sparkles, Heart, Wrench } from "lucide-react";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import type { BadgeTone } from "@/components/gui";
import type { Tier } from "@/lib/supabase/types";

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

function inkOn(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "var(--gui-ink-strong)";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "var(--gui-ink-strong)" : "var(--gui-paper)";
}

/**
 * The class chip: the family's colour as a round fill with its icon, then the
 * name in ink (the family colours themselves are too light for text on
 * paper). Renders nothing for unknown / missing classes so callers can use it
 * unconditionally.
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
  const chip = Math.round(iconSize * 1.5);
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: "var(--gui-ink)", fontSize, fontWeight: 800, lineHeight: 1.2 }}>
      <span
        aria-hidden
        className="inline-grid shrink-0 place-items-center"
        style={{ width: chip, height: chip, borderRadius: "var(--gui-r-blob)", background: meta.color, color: inkOn(meta.color), boxShadow: "inset 0 0 0 1.5px rgb(58 46 34 / 0.14)" }}
      >
        <Icon style={{ width: iconSize, height: iconSize }} />
      </span>
      {showName ? cls : <span className="sr-only">{cls}</span>}
    </span>
  );
}

export const TIER_LOOK: Record<Tier, { tone: BadgeTone; ring: string }> = {
  1: { tone: "gold", ring: "var(--gui-gold)" },
  2: { tone: "sage", ring: "var(--gui-sage)" },
  3: { tone: "info", ring: "var(--gui-info)" },
  4: { tone: "success", ring: "var(--gui-success)" },
  5: { tone: "neutral", ring: "var(--gui-paper-line)" },
};
