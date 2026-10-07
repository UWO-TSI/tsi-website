import { describe, expect, it } from "vitest";
import { blockForHour, buildMusicSrcList, fallbackTrackFor, musicBlockAt, MUSIC_BLOCKS } from "./musicSchedule";

describe("musicSchedule", () => {
  it("has twelve two-hour blocks covering the day", () => {
    expect(MUSIC_BLOCKS).toEqual(["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"]);
  });

  it("picks the block a fractional hour falls in", () => {
    expect(blockForHour(0)).toBe("00");
    expect(blockForHour(1.99)).toBe("00");
    expect(blockForHour(2)).toBe("02");
    expect(blockForHour(13.5)).toBe("12");
    expect(blockForHour(23.99)).toBe("22");
  });

  it("wraps hours outside 0-24 the same way real clock math would", () => {
    expect(blockForHour(24)).toBe("00");
    expect(blockForHour(-0.5)).toBe("22");
  });

  it("rolls over at midnight in Toronto local time", () => {
    // 2026-11-15 is well clear of any DST edge; 04:59 UTC = 23:59 EST (block 22),
    // one minute later crosses into the next day's 00:00-02:00 block.
    const beforeMidnight = new Date("2026-11-15T04:59:00.000Z");
    const afterMidnight = new Date("2026-11-15T05:01:00.000Z");
    expect(musicBlockAt(beforeMidnight)).toBe("22");
    expect(musicBlockAt(afterMidnight)).toBe("00");
  });

  it("follows the real DST spring-forward jump instead of computing a stale block", () => {
    // 2026-03-08 is the DST start for America/Toronto: 01:59:59 EST jumps
    // straight to 03:00:00 EDT. Both instants below are two minutes apart in
    // UTC but the clock they drive skips the 02:00-04:00 block's start entirely.
    const justBeforeJump = new Date("2026-03-08T06:59:00.000Z"); // 01:59 EST
    const justAfterJump = new Date("2026-03-08T07:01:00.000Z"); // 03:01 EDT
    expect(musicBlockAt(justBeforeJump)).toBe("00");
    expect(musicBlockAt(justAfterJump)).toBe("02");
  });

  it("splits the fallback tracks between day-leaning and night-leaning blocks", () => {
    expect(fallbackTrackFor("12")).toBe("/audio/ambient/applicant-ocean-railway.ogg");
    expect(fallbackTrackFor("08")).toBe("/audio/ambient/applicant-ocean-railway.ogg");
    expect(fallbackTrackFor("22")).toBe("/audio/ambient/applicant-willow-tree.ogg");
    expect(fallbackTrackFor("00")).toBe("/audio/ambient/applicant-willow-tree.ogg");
  });

  const ALL = new Set(["cafe.mp3", "interior.mp3", "14-winter.mp3", "14.mp3", "06.mp3"]);

  it("orders candidates: cafe override first when set", () => {
    expect(buildMusicSrcList("12", { override: "cafe" }, ALL)).toEqual([
      "/assets/audio/music/cafe.mp3",
      "/audio/ambient/applicant-ocean-railway.ogg",
    ]);
  });

  it("orders candidates: interior override first when set", () => {
    expect(buildMusicSrcList("22", { override: "interior" }, ALL)).toEqual([
      "/assets/audio/music/interior.mp3",
      "/audio/ambient/applicant-willow-tree.ogg",
    ]);
  });

  it("orders candidates: seasonal variant, then the plain block, then the fallback", () => {
    expect(buildMusicSrcList("14", { season: "winter" }, ALL)).toEqual([
      "/assets/audio/music/14-winter.mp3",
      "/assets/audio/music/14.mp3",
      "/audio/ambient/applicant-ocean-railway.ogg",
    ]);
  });

  it("skips the seasonal candidate when no season is given", () => {
    expect(buildMusicSrcList("06", {}, ALL)).toEqual([
      "/assets/audio/music/06.mp3",
      "/audio/ambient/applicant-ocean-railway.ogg",
    ]);
  });

  it("requests only the files that are on disk, then the fallback", () => {
    expect(buildMusicSrcList("14", { season: "winter" }, new Set(["14.mp3"]))).toEqual([
      "/assets/audio/music/14.mp3",
      "/audio/ambient/applicant-ocean-railway.ogg",
    ]);
    expect(buildMusicSrcList("20", { season: "autumn", override: "cafe" }, new Set())).toEqual([
      "/audio/ambient/applicant-willow-tree.ogg",
    ]);
  });
});
