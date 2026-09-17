import type { Position } from "./recruitment";

type Schedule = Pick<Position, "is_active" | "archived_at" | "opens_at" | "closes_at">;

export function recruitmentCountdown(position: Schedule, now: number): { label: string; remaining?: string; date?: string } {
  if (position.archived_at) return { label: "Applications closed" };
  const opens = position.opens_at ? Date.parse(position.opens_at) : NaN;
  const closes = position.closes_at ? Date.parse(position.closes_at) : NaN;
  if (Number.isFinite(closes) && closes <= now) return { label: "Applications closed" };
  if (!position.is_active) return { label: "Not accepting applications yet" };
  const opening = Number.isFinite(opens) && opens > now;
  const deadline = opening ? opens : closes;
  if (!Number.isFinite(deadline)) return { label: "Application dates coming soon" };
  const total = Math.max(0, Math.ceil((deadline - now) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor(total % 86400 / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const seconds = total % 60;
  return {
    label: opening ? "Opens in" : "Closes in",
    remaining: `${days ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(deadline),
  };
}
