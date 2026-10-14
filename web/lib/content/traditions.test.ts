import { describe, expect, it } from "vitest";
import { DEFAULT_TRADITIONS, contentOn, costumeEvents, monthDay, nightKey, normalizeTradition, traditionOpen, validateTraditionDraft, windowLabel, type Tradition } from "./traditions";

const halloween = DEFAULT_TRADITIONS.find((t) => t.id === "halloween")!;
const at = (iso: string) => Date.parse(iso);

describe("the traditions calendar (lib/content/traditions.ts)", () => {
  it("seeds Halloween, Oct 25 to Nov 1, with all four kinds of content", () => {
    expect(halloween).toMatchObject({ starts_on: "10-25", ends_on: "11-01", active: true });
    expect(halloween.content).toEqual({ pumpkins: true, costumes: true, trick_or_treat: true, fog_nights: true });
    expect(windowLabel(halloween)).toBe("Oct 25 to Nov 1");
  });

  it("opens and closes on Toronto midnights, not UTC's", () => {
    // Oct 24 23:59 EDT (UTC−4) is still before it; Oct 25 00:00 EDT is the first minute.
    expect(traditionOpen(halloween, at("2026-10-25T03:59:00Z"))).toBe(false);
    expect(traditionOpen(halloween, at("2026-10-25T04:00:00Z"))).toBe(true);
    // Toronto leaves DST at 2 a.m. on Nov 1 2026: the last minute is Nov 1 23:59 EST (UTC−5), 04:59 UTC on the 2nd.
    expect(traditionOpen(halloween, at("2026-11-02T04:59:00Z"))).toBe(true);
    expect(traditionOpen(halloween, at("2026-11-02T05:00:00Z"))).toBe(false);
    // Midday UTC on Oct 31 and the next year's window too: it repeats.
    expect(traditionOpen(halloween, at("2026-10-31T16:00:00Z"))).toBe(true);
    expect(traditionOpen(halloween, at("2027-10-26T12:00:00Z"))).toBe(true);
    expect(traditionOpen(halloween, at("2026-10-13T12:00:00Z"))).toBe(false);
  });

  it("wraps a window across the new year, and an inactive or broken one never opens", () => {
    const lights: Tradition = { ...halloween, id: "lights", starts_on: "12-20", ends_on: "01-05" };
    expect(traditionOpen(lights, at("2026-12-31T17:00:00Z"))).toBe(true);
    expect(traditionOpen(lights, at("2027-01-05T17:00:00Z"))).toBe(true);
    expect(traditionOpen(lights, at("2027-01-06T17:00:00Z"))).toBe(false);
    expect(traditionOpen(lights, at("2026-12-19T17:00:00Z"))).toBe(false);
    expect(traditionOpen({ ...halloween, active: false }, at("2026-10-31T16:00:00Z"))).toBe(false);
    expect(traditionOpen({ ...halloween, ends_on: "11-31" }, at("2026-10-31T16:00:00Z"))).toBe(false);
    expect(monthDay("02-29")).toBe(229);
    expect(monthDay("02-30")).toBeNull();
  });

  it("switches on what any running tradition does, and names whose costumes are free", () => {
    const rows = [halloween, { ...halloween, id: "quiet", content: { fog_nights: true }, starts_on: "10-30", ends_on: "10-30" }];
    expect(contentOn(rows, at("2026-10-13T16:00:00Z"))).toEqual({ pumpkins: false, costumes: false, trick_or_treat: false, fog_nights: false });
    expect(contentOn(rows, at("2026-10-31T16:00:00Z"))).toEqual({ pumpkins: true, costumes: true, trick_or_treat: true, fog_nights: true });
    expect(contentOn([{ ...halloween, content: { pumpkins: true } }], at("2026-10-31T16:00:00Z"))).toMatchObject({ pumpkins: true, costumes: false });
    expect([...costumeEvents(rows, at("2026-10-31T16:00:00Z"))]).toEqual(["halloween"]);
    expect(costumeEvents(rows, at("2026-11-03T16:00:00Z")).size).toBe(0);
  });

  it("keys a night by its evening's Toronto date: after midnight is still the night before", () => {
    expect(nightKey(at("2026-10-26T00:00:00Z"))).toBe("2026-10-25"); // Oct 25, 8 p.m. EDT
    expect(nightKey(at("2026-10-26T05:00:00Z"))).toBe("2026-10-25"); // Oct 26, 1 a.m. EDT
    expect(nightKey(at("2026-10-26T17:00:00Z"))).toBe("2026-10-26"); // Oct 26, 1 p.m.: the next night's day
    expect(nightKey(at("2026-11-02T04:30:00Z"))).toBe("2026-11-01"); // Nov 1, 11:30 p.m. EST
  });

  it("checks an admin's draft", () => {
    expect(validateTraditionDraft({ ...halloween })).toEqual([]);
    expect(validateTraditionDraft({ ...halloween, id: "Hallo Ween" })).toHaveLength(1);
    expect(validateTraditionDraft({ ...halloween, starts_on: "13-01", ends_on: "1-5" })).toHaveLength(2);
    expect(validateTraditionDraft({ ...halloween, content: {} })).toEqual(["Content: switch at least one thing on."]);
    expect(validateTraditionDraft({ ...halloween, content: { confetti: true } })[0]).toMatch(/unknown confetti/);
    expect(normalizeTradition({ id: "x", title: "X", starts_on: "01-01", ends_on: "01-02", content: { pumpkins: true, confetti: true, fog_nights: false }, position: 3 }))
      .toEqual({ id: "x", title: "X", starts_on: "01-01", ends_on: "01-02", content: { pumpkins: true }, position: 3, active: true });
  });
});
