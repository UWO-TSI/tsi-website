import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AMBIENT_VARIANTS, ambientCandidates, type AmbientPhase } from "./audio";
import { buildMusicSrcList, MUSIC_BLOCKS, MUSIC_FILES, type MusicOverride } from "./musicSchedule";
import { ISLAND_WEATHERS } from "./islandWeather";
import { SEASONS } from "./season";

// Audit 2026-10 world item 19: every load asked for variant files that were never authored (404s). The players only
// request files that are on disk.
const PUBLIC = join(__dirname, "../../public");
const onDisk = (src: string) => existsSync(join(PUBLIC, src));
const PHASES: AmbientPhase[] = ["dawn", "day", "dusk", "night", "applicant-island", "applicant-hq"];
const OVERRIDES: MusicOverride[] = [null, "cafe", "interior"];

describe("audio requests only files on disk", () => {
  it("ambient: every phase, weather and season", () => {
    for (const phase of PHASES) for (const weather of [undefined, ...ISLAND_WEATHERS]) for (const season of [undefined, ...SEASONS]) {
      const list = ambientCandidates({ phase, weather, season });
      expect(list.length).toBeGreaterThan(0);
      for (const src of list) expect(onDisk(src), `${phase}/${weather}/${season}: ${src}`).toBe(true);
    }
  });

  it("music: every block, season and override", () => {
    for (const block of MUSIC_BLOCKS) for (const season of [undefined, ...SEASONS]) for (const override of OVERRIDES) {
      const list = buildMusicSrcList(block, { season, override });
      expect(list.length).toBeGreaterThan(0);
      for (const src of list) expect(onDisk(src), `${block}/${season}/${override}: ${src}`).toBe(true);
    }
  });

  it("every listed variant and track is on disk", () => {
    for (const name of AMBIENT_VARIANTS) expect(onDisk(`/audio/ambient/${name}.ogg`), name).toBe(true);
    for (const name of MUSIC_FILES) expect(onDisk(`/assets/audio/music/${name}`), name).toBe(true);
  });

  it("a listed variant is tried first", () => {
    expect(ambientCandidates({ phase: "day", weather: "rain", season: "autumn" }, new Set(["day-rain", "day-autumn"])))
      .toEqual(["/audio/ambient/day-rain.ogg", "/audio/ambient/day-autumn.ogg", "/audio/ambient/day.ogg"]);
    expect(ambientCandidates({ phase: "day", weather: "rain", season: "autumn" }, new Set(["day-autumn"])))
      .toEqual(["/audio/ambient/day-autumn.ogg", "/audio/ambient/day.ogg"]);
  });
});
