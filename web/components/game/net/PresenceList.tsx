"use client";

/**
 * Who's on the island (specs/multiplayer.md §5.7): the whole shard's roster, grouped by where they are (the village,
 * the café, HQ, the museum, the Oracle, in the ruins, on their own island), each with the member dot, a phone for
 * someone on their phone, and their level when they're in view. Read-only in M1 (mute, block and report come in M2,
 * parties in M3, visits in M4). A paper sheet through the one dialog system, so the world's keys hold still while it's
 * open. World names only (row 222).
 */
import { useMemo } from "react";
import { Users } from "lucide-react";
import { Empty, List, ListRow, Sheet } from "@/components/gui";
import { AREAS, FLAG, hasFlag, type Area, type RosterEntry } from "@/lib/net/protocol";
import { useRoster } from "@/lib/net/netStore";
import type { NetSource } from "@/lib/net/types";
import { activeNet, useRemoteUids } from "./active";
import s from "./net.module.css";

/** The roster's groups, in this order; ruins and homes are private (nobody sees them) but stay listed. */
export const AREA_GROUPS: readonly { label: string; areas: readonly Area[] }[] = [
  { label: "Village", areas: ["village"] }, { label: "Café", areas: ["cafe"] }, { label: "HQ", areas: ["hq"] }, { label: "Museum", areas: ["museum"] },
  { label: "Oracle", areas: ["oracle"] }, { label: "In the ruins", areas: ["ruins"] }, { label: "On their island", areas: ["home", "house"] },
];
/** Where you are, said in the list's header. */
const YOU_ARE: Record<Area, string> = { village: "in the village", cafe: "in the café", hq: "at HQ", museum: "in the museum", oracle: "in the Oracle temple",
  ruins: "in the ruins", home: "on your island", house: "on your island" };

/** The roster by place, the groups that have anyone, names in order within each. */
export function groupRoster(roster: readonly RosterEntry[]): { label: string; people: RosterEntry[] }[] {
  return AREA_GROUPS.map(g => ({
    label: g.label,
    people: roster.filter(r => g.areas.includes(AREAS[r.area])).sort((a, b) => a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid)),
  })).filter(g => g.people.length > 0);
}
/** The levels of the players in view (`uids`; the roster doesn't carry one), by user id. */
export function levelsInView(source: NetSource | null, uids: ReadonlySet<string>): ReadonlyMap<string, number> {
  const out = new Map<string, number>(), reg = source?.remotes;
  if (reg) for (let i = 0; i < reg.size; i++) { const p = reg.at(i).player; if (p.level > 0 && uids.has(p.uid)) out.set(p.uid, p.level); }
  return out;
}

/** A small phone in the paper kit's ink (not an emoji). */
export function PhoneIcon({ label }: { label?: string }) {
  return <span className={s.phone} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <svg viewBox="0 0 10 15" width="10" height="15"><rect x="0.9" y="0.9" width="8.2" height="13.2" rx="2.3" /><path d="M3.7 3h2.6" /><circle cx="5" cy="11.5" r="0.95" /></svg>
  </span>;
}

function Person({ p, level }: { p: RosterEntry; level?: number }) {
  const member = p.badge === 1, phone = hasFlag(p.flags, FLAG.mobile), away = hasFlag(p.flags, FLAG.away);
  return <ListRow className={s.person} data-away={away || undefined}
    title={<span className={s.personName}>
      {member && <span className={s.memberDot} role="img" aria-label="TSI member" title="TSI member" />}
      {p.name}
      {phone && <PhoneIcon label="On their phone" />}
    </span>}
    detail={away ? "Away for a moment" : undefined}
    value={level ? <span className={s.personLevel}>Lv {level}</span> : undefined} />;
}

export default function PresenceList({ open, onClose, area }: { open: boolean; onClose: () => void;
  /** Where you are (you're in the roster too). */
  area: Area }) {
  const roster = useRoster(), inView = useRemoteUids();
  const groups = useMemo(() => groupRoster(roster), [roster]);
  // Their cards come with the view: read again when who's in view changes.
  const levels = useMemo(() => levelsInView(activeNet(), inView), [inView]);
  const alone = roster.length <= 1;
  return <Sheet open={open} onClose={onClose} size="sm" icon={<Users size={20} />} testId="presence-list"
    title="People on the island" eyebrow={`${roster.length} on the island · you're ${YOU_ARE[area]}`}>
    {alone ? <Empty icon={<Users size={28} />} title="Just you for now">Others show up here as they come onto the island.</Empty>
      : groups.map(g => <section key={g.label} className={s.group} aria-label={g.label}>
        <h3 className={s.groupHead}>{g.label}<small>{g.people.length}</small></h3>
        <List label={g.label}>{g.people.map(p => <Person key={p.uid} p={p} level={levels.get(p.uid)} />)}</List>
      </section>)}
  </Sheet>;
}
