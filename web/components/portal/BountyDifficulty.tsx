import { Skull } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/gui";

/** Gentle to grim, for the 1-5 that admins approve a bounty at (bounties.difficulty). */
const TONES: Record<number, BadgeTone> = { 1: "success", 2: "success", 3: "warn", 4: "danger", 5: "danger" };

/** A bounty's difficulty as admins approve it: that many skulls, out of 5. Nothing outside 1-5. */
export function BountyDifficulty({ level }: { level: number }) {
  if (!TONES[level]) return null;
  return (
    <Badge tone={TONES[level]} title={`Difficulty ${level} of 5`}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: level }, (_, i) => <Skull key={i} size={12} />)}
      </span>
      <span className="sr-only">Difficulty {level} of 5</span>
    </Badge>
  );
}
