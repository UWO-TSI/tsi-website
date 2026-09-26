// Logged playback timeline for the audio pass (specs/audio-pass.md item 4).
// Runs the real production modules (musicSchedule.ts, islandTime.ts) at
// forced instants — no browser needed since block selection is pure. Run
// from web/ with: npx vite-node ../specs/evidence/audio/playback-timeline.ts
import { musicBlockAt, buildMusicSrcList, fallbackTrackFor } from "../../../web/lib/game/musicSchedule";
import { torontoHour } from "../../../web/lib/game/islandTime";

const cases: { label: string; date: Date; season?: "spring" | "summer" | "autumn" | "winter"; override?: "cafe" | "interior" | null }[] = [
  { label: "Midnight, outdoors", date: new Date("2026-11-15T05:00:00.000Z") }, // 00:00 EST
  { label: "One minute before midnight (previous block)", date: new Date("2026-11-15T04:59:00.000Z") }, // 23:59 EST
  { label: "One minute after midnight (next block)", date: new Date("2026-11-15T05:01:00.000Z") }, // 00:01 EST
  { label: "Dawn, 06:30", date: new Date("2026-11-15T11:30:00.000Z") }, // 06:30 EST
  { label: "Midday, 13:00, winter variant requested", date: new Date("2026-12-15T18:00:00.000Z"), season: "winter" }, // 13:00 EST
  { label: "Evening, 19:15", date: new Date("2026-11-15T00:15:00.000Z") }, // 19:15 EST (previous day UTC)
  { label: "Inside the cafe at midday", date: new Date("2026-11-15T18:00:00.000Z"), override: "cafe" }, // 13:00 EST
  { label: "Inside HQ (generic interior) at midday", date: new Date("2026-11-15T18:00:00.000Z"), override: "interior" },
  { label: "DST spring-forward: 01:59 EST, just before the jump", date: new Date("2026-03-08T06:59:00.000Z") },
  { label: "DST spring-forward: 03:01 EDT, just after the jump", date: new Date("2026-03-08T07:01:00.000Z") },
];

console.log("block | toronto-hour | override | candidates (first = what plays until Suno tracks land)");
console.log("-".repeat(100));
for (const c of cases) {
  const block = musicBlockAt(c.date);
  const hour = torontoHour(c.date).toFixed(2);
  const candidates = buildMusicSrcList(block, { season: c.season, override: c.override ?? null });
  console.log(`${c.label}`);
  console.log(`  block=${block}  torontoHour=${hour}  override=${c.override ?? "none"}${c.season ? `  season=${c.season}` : ""}`);
  console.log(`  candidates: ${candidates.join(" -> ")}`);
  console.log(`  plays today (no assets authored yet): ${candidates[candidates.length - 1]} (== fallbackTrackFor: ${fallbackTrackFor(block)})`);
  console.log("");
}
